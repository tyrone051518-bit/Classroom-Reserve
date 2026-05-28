package SCHEDmodels

// =========================
// ACTIVE SCHEDULE (MAIN DATA)
// =========================
type ActiveSchedule struct {
	ID           int `json:"id"`
	PermaSchedID int `json:"perma_sched_id"`

	ScheduleDate string `json:"schedule_date"`

	TeacherID *int    `json:"teacher_id,omitempty"`
	Professor *string `json:"professor,omitempty"`

	Room         string  `json:"room"`
	SubjectCode  *string `json:"subject_code,omitempty"`
	ClassSection *string `json:"class_section,omitempty"`

	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`

	Status string `json:"status"` // VACANT | OCCUPIED

	UpdatedBy *int `json:"updated_by,omitempty"`
}

// =========================
// UPDATE REQUEST (TEACHER EDIT)
// =========================
type UpdateScheduleRequest struct {
	ScheduleID int `json:"schedule_id"`
	TeacherID  int `json:"teacher_id"`

	SubjectCode  *string `json:"subject_code,omitempty"`
	ClassSection *string `json:"class_section,omitempty"`

	Status string `json:"status"` // VACANT | OCCUPIED
}

// =========================
// GENERATE SCHEDULE REQUEST
// =========================
type GenerateScheduleRequest struct {
	Date string `json:"date"` // format: "2026-05-23"
}

type ReplaceScheduleRequest struct {
	SourceScheduleID int `json:"source_schedule_id"`
	TargetScheduleID int `json:"target_schedule_id"`
}

// =========================
// STANDARD API RESPONSE
// =========================
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// =========================
// FRONTEND ROOM VIEW MODEL
// (matches your React dashboard)
// =========================
type RoomView struct {
	ID        int    `json:"id"`
	Room      string `json:"room"`
	Subject   string `json:"subject"`
	Professor string `json:"professor"`
	Section   string `json:"section"`
	Time      string `json:"time"`
	Status    string `json:"status"`
}
