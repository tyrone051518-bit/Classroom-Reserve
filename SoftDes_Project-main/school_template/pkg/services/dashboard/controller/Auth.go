package controller

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	DBConnection "template_school/pkg/middleware/databaseConnection"
	SCHEDmodels "template_school/pkg/services/dashboard/models"
	SCHEDscript "template_school/pkg/services/dashboard/script"

	"github.com/gofiber/fiber/v3"
)

var DB *sql.DB

func getDB() *sql.DB {
	if DB != nil {
		return DB
	}

	gormDB := DBConnection.GetDB()
	if gormDB == nil {
		return nil
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil
	}

	DB = sqlDB
	return DB
}

func getUserID(c fiber.Ctx) int {
	if uid := c.Locals("user_id"); uid != nil {
		switch v := uid.(type) {
		case int:
			return v
		case int64:
			return int(v)
		case float64:
			return int(v)
		case string:
			if n, err := strconv.Atoi(v); err == nil {
				return n
			}
		}
	}
	return 0
}

func parseScheduleEndTime(dateStr, endTime string, loc *time.Location) (time.Time, error) {
	layouts := []string{
		"2006-01-02 15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 3:04PM",
		"2006-01-02 3:04:05PM",
		"2006-01-02 15:04:05.999",
	}

	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, fmt.Sprintf("%s %s", dateStr, endTime), loc); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("invalid end time format: %s", endTime)
}

func cleanupExpiredSchedules(db *sql.DB, loc *time.Location) error {
	today := time.Now().In(loc)
	dateStr := today.Format("2006-01-02")

	if _, err := db.Exec(`
		DELETE FROM active_sched
		WHERE schedule_date < $1
	`, dateStr); err != nil {
		return err
	}

	rows, err := db.Query(`
		SELECT id, schedule_date, end_time
		FROM active_sched
		WHERE schedule_date = $1
	`, dateStr)
	if err != nil {
		return err
	}
	defer rows.Close()

	var expiredIDs []int
	for rows.Next() {
		var id int
		var scheduleDate string
		var endTime string
		if err := rows.Scan(&id, &scheduleDate, &endTime); err != nil {
			return err
		}

		expiresAt, err := parseScheduleEndTime(scheduleDate, endTime, loc)
		if err != nil {
			continue
		}

		if !expiresAt.After(today) {
			expiredIDs = append(expiredIDs, id)
		}
	}

	if err := rows.Err(); err != nil {
		return err
	}

	for _, id := range expiredIDs {
		if _, err := db.Exec(`DELETE FROM active_sched WHERE id = $1`, id); err != nil {
			return err
		}
	}

	return nil
}

func GetActiveSchedule(c fiber.Ctx) error {
	db := getDB()
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "database not connected"})
	}

	// Use Philippine time (UTC+8)
	loc, err := time.LoadLocation("Asia/Manila")
	if err != nil {
		loc = time.FixedZone("PHT", 8*60*60)
	}
	today := time.Now().In(loc)

	// Only Mon-Thu are valid school days
	switch today.Weekday() {
	case time.Monday, time.Tuesday, time.Wednesday, time.Thursday:
		// ok
	default:
		return c.JSON(fiber.Map{"data": []SCHEDmodels.ActiveSchedule{}})
	}

	// Read role and user_id from JWT locals when present
	role := ""
	if rl := c.Locals("role"); rl != nil {
		role = fmt.Sprintf("%v", rl)
	}

	userID := 0
	if uid := c.Locals("user_id"); uid != nil {
		switch v := uid.(type) {
		case int:
			userID = v
		case int64:
			userID = int(v)
		case float64:
			userID = int(v)
		case string:
			if n, err := strconv.Atoi(v); err == nil {
				userID = n
			}
		}
	}

	// Try to read teacher_id from query if present (overrides userID)
	teacherQ := c.Query("teacher_id")
	if teacherQ != "" {
		if v, err := strconv.Atoi(teacherQ); err == nil {
			userID = v
		}
	}

	// If logged in teacher and no explicit teacher filter was sent, use their own ID
	if role == "TEACHER" && teacherQ == "" && userID > 0 {
		teacherQ = strconv.Itoa(userID)
	}

	// Remove stale schedule rows before generating or returning schedule data
	if err := cleanupExpiredSchedules(db, loc); err != nil {
		fmt.Printf("failed to cleanup expired schedules: %v\n", err)
	}

	// Generate active schedule entries if necessary
	_ = SCHEDscript.GenerateActiveScheduleForUser(db, userID, role, today)

	dateStr := today.Format("2006-01-02")
	day := strings.ToUpper(today.Weekday().String()[:3])
	schedules, err := SCHEDscript.GetActiveScheduleByDate(db, dateStr, day)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var out []SCHEDmodels.ActiveSchedule

	now := time.Now().In(loc)
	for _, s := range schedules {
		// Parse schedule end datetime
		endLayout := "2006-01-02 15:04"
		dtStr := fmt.Sprintf("%s %s", s.ScheduleDate, s.EndTime)
		endTime, err := time.Parse(endLayout, dtStr)
		if err != nil {
			endLayout2 := "2006-01-02 15:04:05"
			endTime, err = time.Parse(endLayout2, dtStr)
			if err != nil {
				// If parse fails, keep the row
				out = append(out, s)
				continue
			}
		}

		if endTime.Before(now) || endTime.Equal(now) {
			_ = SCHEDscript.DeleteActiveScheduleByID(db, s.ID)
			continue
		}

		out = append(out, s)
	}

	return c.JSON(fiber.Map{"data": out})
}

func ReplaceSchedule(c fiber.Ctx) error {
	db := getDB()
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "database not connected"})
	}

	role := ""
	if rl := c.Locals("role"); rl != nil {
		role = fmt.Sprintf("%v", rl)
	}
	if strings.ToUpper(role) != "TEACHER" {
		return c.Status(403).JSON(fiber.Map{"message": "only teachers can replace schedules"})
	}

	userID := getUserID(c)

	var req SCHEDmodels.ReplaceScheduleRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"message": "invalid request body", "error": err.Error()})
	}

	if req.SourceScheduleID == 0 || req.TargetScheduleID == 0 {
		return c.Status(400).JSON(fiber.Map{"message": "source_schedule_id and target_schedule_id are required"})
	}

	if req.SourceScheduleID == req.TargetScheduleID {
		return c.Status(400).JSON(fiber.Map{"message": "source and target schedules must differ"})
	}

	if err := SCHEDscript.SwapTeacherSchedule(db, userID, req.SourceScheduleID, req.TargetScheduleID); err != nil {
		return c.Status(400).JSON(fiber.Map{"message": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Schedule replaced successfully"})
}
