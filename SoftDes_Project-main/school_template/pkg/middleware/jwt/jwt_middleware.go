package jwt

import (
	"strings"

	"github.com/gofiber/fiber/v3"
)

func AuthMiddleware(c fiber.Ctx) error {
	auth := c.Get("Authorization")

	if auth == "" {
		return c.Status(401).JSON(fiber.Map{"message": "missing token"})
	}

	tokenStr := strings.TrimSpace(strings.Replace(auth, "Bearer ", "", 1))

	claims, err := ParseToken(tokenStr) // 👈 direct call, no import
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"message": "invalid token"})
	}

	c.Locals("user_id", claims.UserID)
	c.Locals("role", claims.AccountRole)
	c.Locals("name", claims.Name)

	return c.Next()
}
