package REGISTERscript

import (
	"fmt"

	DBConnection "template_school/pkg/middleware/databaseConnection"
	emailService "template_school/pkg/services/email"
	REGISTERmodels "template_school/pkg/services/register/models"

	"golang.org/x/crypto/bcrypt"
)

func RegisterUser(req REGISTERmodels.RequestBody) (*REGISTERmodels.UserData, error) {

	// 1. Validate input
	if req.Email == "" || req.IDNumber == "" || req.Password == "" {
		return nil, fmt.Errorf("email, id number, and password are required")
	}

	// 2. Get DB connection
	db := DBConnection.GetDB()
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// 3. Check if user already exists
	var existingID int

	err := db.Raw(`
		SELECT id
		FROM users
		WHERE email = ? OR id_number = ?
		LIMIT 1
	`, req.Email, req.IDNumber).Scan(&existingID).Error

	if err != nil {
		return nil, fmt.Errorf("database error")
	}

	if existingID != 0 {
		return nil, fmt.Errorf("user already exists")
	}

	// 4. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password")
	}

	// 4.5. Generate verification token
	verificationToken, err := emailService.GenerateVerificationToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification token")
	}

	// 5. Insert user + return DB data
	var user REGISTERmodels.UserData

	err = db.Raw(`
		INSERT INTO users (id_number, email, password_hash, is_verified, verification_token)
		VALUES (?, ?, ?, FALSE, ?)
		RETURNING id, id_number, email, is_verified, verification_token
	`,
		req.IDNumber,
		req.Email,
		string(hashedPassword),
		verificationToken,
	).Scan(&user).Error

	if err != nil {
		return nil, fmt.Errorf("failed to create user")
	}

	// 6. Send verification email
	if err := emailService.SendVerificationEmail(req.Email, verificationToken); err != nil {
		// Log the error but don't fail the registration
		fmt.Printf("Warning: failed to send verification email: %v\n", err)
		// Optionally: return nil, fmt.Errorf("registration successful but failed to send verification email")
	}

	// 7. Success
	return &user, nil
}

// VerifyEmailToken finds a user by verification token, marks them verified,
// clears the token and returns the updated user data.
func VerifyEmailToken(token string) (*REGISTERmodels.UserData, error) {
	if token == "" {
		return nil, fmt.Errorf("verification token required")
	}

	db := DBConnection.GetDB()
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	var user REGISTERmodels.UserData
	err := db.Raw(`
		UPDATE users
		SET is_verified = TRUE,
			verified_at = now(),
			verification_token = NULL
		WHERE verification_token = ?
		RETURNING id, id_number, email, is_verified
	`, token).Scan(&user).Error

	if err != nil {
		return nil, fmt.Errorf("invalid or expired verification token")
	}

	return &user, nil
}
