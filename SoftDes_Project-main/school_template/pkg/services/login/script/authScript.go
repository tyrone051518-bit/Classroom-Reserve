package AUTHscript

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"

	DBConnection "template_school/pkg/middleware/databaseConnection"
	JWT "template_school/pkg/middleware/jwt"
	AUTHmodels "template_school/pkg/services/login/models"
)

func AuthScriptLogin(req AUTHmodels.RequestBody) (AUTHmodels.Response, error) {

	if req.Login == "" || req.Password == "" {
		return AUTHmodels.Response{}, fmt.Errorf("login and password required")
	}

	db := DBConnection.GetDB()
	if db == nil {
		return AUTHmodels.Response{}, fmt.Errorf("database not connected")
	}

	var user struct {
		ID           int
		Login        string
		PasswordHash string
		AccountRole  string
		Name         string
	}

	err := db.Raw(`
		SELECT 
			id,
			id_number,
			password_hash,
			account_role,
			name
		FROM users
		WHERE id_number = ? OR email = ?
		LIMIT 1
	`, req.Login, req.Login).Scan(&user).Error

	if err != nil || user.ID == 0 {
		return AUTHmodels.Response{}, fmt.Errorf("invalid credentials")
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(req.Password),
	)

	if err != nil {
		return AUTHmodels.Response{}, fmt.Errorf("invalid credentials")
	}

	token, err := JWT.GenerateToken(user.ID, user.Login, user.AccountRole, user.Name)
	if err != nil {
		return AUTHmodels.Response{}, fmt.Errorf("failed to generate token")
	}

	return AUTHmodels.Response{
		Message:     "login successful",
		Token:       token,
		ID:          user.ID,
		Name:        user.Name,
		AccountRole: user.AccountRole,
	}, nil
}
