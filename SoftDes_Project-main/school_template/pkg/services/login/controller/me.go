package AUTHcontroller

import (
	"strings"

	JWT "template_school/pkg/middleware/jwt"

	"github.com/gofiber/fiber/v3"
)

func Me(c fiber.Ctx) error {

	auth := c.Get("Authorization")
	if auth == "" {
		return c.Status(401).JSON(fiber.Map{
			"message": "missing token",
		})
	}

	tokenStr := strings.Replace(auth, "Bearer ", "", 1)

	claims, err := JWT.ParseToken(tokenStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{
			"message": "invalid token",
		})
	}

	return c.Status(200).JSON(fiber.Map{
		"id":           claims.UserID,
		"name":         claims.Name,
		"account_role": claims.AccountRole,
	})
}
