package REGISTERmodels

// Request body from frontend
type RequestBody struct {
	Email    string `json:"email"`
	IDNumber string `json:"idNumber"`
	Password string `json:"password"`
}

// User returned from DB
type UserData struct {
	ID                int    `json:"id"`
	IDNumber          string `json:"id_number"`
	Email             string `json:"email"`
	IsVerified        bool   `json:"is_verified"`
	VerificationToken string `json:"verification_token,omitempty"`
}

// API response
type Response struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	User    *UserData `json:"user,omitempty"`
}
