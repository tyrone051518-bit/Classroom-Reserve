package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var SecretKey = []byte("SUPER_SECRET_KEY_CHANGE_THIS") // move to env later

type Claims struct {
	UserID      int    `json:"user_id"`
	UserLogin   string `json:"user_login,omitempty"`
	AccountRole string `json:"account_role"`
	Name        string `json:"name"`
	jwt.RegisteredClaims
}

// Generate token
func GenerateToken(userID int, login string, role string, name string) (string, error) {
	claims := Claims{
		UserID:      userID,
		UserLogin:   login,
		AccountRole: role,
		Name:        name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(SecretKey)
}

// Parse token
func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (any, error) {
		return SecretKey, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, err
}
