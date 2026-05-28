package SCHEDscript

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	SCHEDmodels "template_school/pkg/services/dashboard/models"
)

func expandSectionName(s string) string {
	res := strings.ToUpper(s)
	res = strings.ReplaceAll(res, "BSPE", "BSCPE")
	res = strings.ReplaceAll(res, "BSE", "BSIE")
	return res
}

func getDayAbbrev(t time.Time) string {
	switch t.Weekday() {
	case time.Monday:
		return "MON"
	case time.Tuesday:
		return "TUE"
	case time.Wednesday:
		return "WED"
	case time.Thursday:
		return "THU"
	case time.Friday:
		return "FRI"
	case time.Saturday:
		return ""
	case time.Sunday:
		return ""
	default:
		return ""
	}
}

func ActiveSchedExists(db *sql.DB, date string) (bool, error) {
	var count int

	err := db.QueryRow(`
		SELECT COUNT(*)
		FROM active_sched
		WHERE schedule_date = $1
	`, date).Scan(&count)

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func generateFullDay(db *sql.DB, dateStr string, day string) error {
	rows, err := db.Query(`
		SELECT
			id,
			teacher_id,
			room,
			subject_code,
			class_section,
			day,
			start_time,
			end_time,
			status
		FROM perma_sched
		WHERE day = $1
	`, day)

	if err != nil {
		return err
	}

	defer rows.Close()

	for rows.Next() {
		var p struct {
			ID           int
			TeacherID    sql.NullInt64
			Room         string
			SubjectCode  sql.NullString
			ClassSection sql.NullString
			Day          string
			StartTime    string
			EndTime      string
			Status       string
		}

		err := rows.Scan(
			&p.ID,
			&p.TeacherID,
			&p.Room,
			&p.SubjectCode,
			&p.ClassSection,
			&p.Day,
			&p.StartTime,
			&p.EndTime,
			&p.Status,
		)

		if err != nil {
			return err
		}

		_, err = db.Exec(`
    INSERT INTO active_sched (
        perma_sched_id,
        schedule_date,
        teacher_id,
        room,
        subject_code,
        class_section,
        day,
        start_time,
        end_time,
        status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`,
			p.ID,
			dateStr,
			p.TeacherID,
			p.Room,
			p.SubjectCode,
			p.ClassSection,
			p.Day,
			p.StartTime,
			p.EndTime,
			p.Status,
		)

		if err != nil {
			return err
		}
	}

	return nil
}

func GenerateActiveScheduleForUser(
	db *sql.DB,
	userID int,
	role string,
	targetDate time.Time,
) error {

	dateStr := targetDate.Format("2006-01-02")
	day := getDayAbbrev(targetDate)

	exists, err := ActiveSchedExists(db, dateStr)
	if err != nil {
		return err
	}

	if exists {
		if role == "TEACHER" {
			fmt.Printf("Teacher %d accessed schedule for %s\n", userID, dateStr)
		}
		return nil
	}

	err = generateFullDay(db, dateStr, day)
	if err != nil {
		return err
	}

	if role == "TEACHER" {
		fmt.Printf("Teacher %d generated schedule for %s\n", userID, dateStr)
	}

	return nil
}

func GetActiveScheduleByDate(
	db *sql.DB,
	date string,
	day string,
) ([]SCHEDmodels.ActiveSchedule, error) {

	rows, err := db.Query(`
		SELECT
			act.id,
			act.perma_sched_id,
			act.schedule_date,
			act.teacher_id,
			act.room,
			act.subject_code,
			act.class_section,
			act.start_time,
			act.end_time,
			act.status,
			act.updated_by,
			u.name as professor_name
		FROM active_sched act
		JOIN perma_sched p ON p.id = act.perma_sched_id
		LEFT JOIN users u ON u.id = act.teacher_id
		WHERE act.schedule_date = $1
		  AND UPPER(p.day) = $2
	`, date, day)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var result []SCHEDmodels.ActiveSchedule

	for rows.Next() {
		var s SCHEDmodels.ActiveSchedule

		var teacherID sql.NullInt64
		var updatedBy sql.NullInt64

		var subjectCode sql.NullString
		var classSection sql.NullString
		var profName sql.NullString

		err := rows.Scan(
			&s.ID,
			&s.PermaSchedID,
			&s.ScheduleDate,
			&teacherID,
			&s.Room,
			&subjectCode,
			&classSection,
			&s.StartTime,
			&s.EndTime,
			&s.Status,
			&updatedBy,
			&profName,
		)

		if err != nil {
			return nil, err
		}

		if teacherID.Valid {
			tid := int(teacherID.Int64)
			s.TeacherID = &tid
		}

		if updatedBy.Valid {
			uid := int(updatedBy.Int64)
			s.UpdatedBy = &uid
		}

		if subjectCode.Valid {
			sub := subjectCode.String
			s.SubjectCode = &sub
		}

		if classSection.Valid {
			sec := expandSectionName(classSection.String)
			s.ClassSection = &sec
		}

		if profName.Valid {
			pn := profName.String
			s.Professor = &pn
		}

		result = append(result, s)
	}

	return result, nil
}

// DeleteActiveScheduleByID removes an active schedule row by id
func DeleteActiveScheduleByID(db *sql.DB, id int) error {
	_, err := db.Exec(`
		DELETE FROM active_sched
		WHERE id = $1
	`, id)
	return err
}

func SwapTeacherSchedule(db *sql.DB, teacherID, sourceID, targetID int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	var srcTeacher sql.NullInt64
	var srcSubject sql.NullString
	var srcSection sql.NullString
	var srcStatus string

	err = tx.QueryRow(`
		SELECT teacher_id, subject_code, class_section, status
		FROM active_sched
		WHERE id = $1
		FOR UPDATE
	`, sourceID).Scan(&srcTeacher, &srcSubject, &srcSection, &srcStatus)
	if err != nil {
		return err
	}

	if !srcTeacher.Valid || int(srcTeacher.Int64) != teacherID {
		return fmt.Errorf("source schedule is not assigned to current teacher")
	}
	if strings.ToUpper(srcStatus) == "VACANT" {
		return fmt.Errorf("source schedule is already vacant")
	}

	var tgtTeacher sql.NullInt64
	var tgtStatus string

	err = tx.QueryRow(`
		SELECT teacher_id, status
		FROM active_sched
		WHERE id = $1
		FOR UPDATE
	`, targetID).Scan(&tgtTeacher, &tgtStatus)
	if err != nil {
		return err
	}

	if tgtTeacher.Valid {
		return fmt.Errorf("target schedule is not vacant")
	}
	if strings.ToUpper(tgtStatus) != "VACANT" {
		return fmt.Errorf("target schedule is not vacant")
	}

	_, err = tx.Exec(`
		UPDATE active_sched
		SET teacher_id = NULL,
		    subject_code = NULL,
		    class_section = NULL,
		    status = 'VACANT',
		    updated_by = $1
		WHERE id = $2
	`, teacherID, sourceID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		UPDATE active_sched
		SET teacher_id = $1,
		    subject_code = $2,
		    class_section = $3,
		    status = 'OCCUPIED',
		    updated_by = $4
		WHERE id = $5
	`, teacherID, srcSubject, srcSection, teacherID, targetID)
	if err != nil {
		return err
	}

	return tx.Commit()
}
