package AUTHcontroller

import (
	DBConnection "template_school/pkg/middleware/databaseConnection"
	AUTHmodels "template_school/pkg/services/login/models"

	AUTHscript "template_school/pkg/services/login/script"

	"github.com/gofiber/fiber/v3"
)

func Login(c fiber.Ctx) error {

	//Reqeust Body from the Model we made using Package calling (Global Calling)
	requestBody := AUTHmodels.RequestBody{}
	if reqErr := c.Bind().Body(&requestBody); reqErr != nil {
		return c.Status(400).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	//Call the function you made in the Script Folder using the Package you define
	resp, err := AUTHscript.AuthScriptLogin(requestBody)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{
			"message": err.Error(),
		})
	}
	//Return the response we Needed (can be modified based on your data needed)
	return c.Status(200).JSON(resp)
}

func UpdateName(c fiber.Ctx) error {
	db := DBConnection.GetDB()

	// Safely handle userID type (int vs float64)
	var userID int
	rawID := c.Locals("user_id")
	switch v := rawID.(type) {
	case int:
		userID = v
	case float64:
		userID = int(v)
	default:
		return c.Status(401).JSON(fiber.Map{"message": "invalid session"})
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind().Body(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"message": "invalid request"})
	}

	err := db.Exec("UPDATE users SET name = ? WHERE id = ?", body.Name, userID).Error
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "failed to update name"})
	}

	return c.Status(200).JSON(fiber.Map{"message": "name updated successfully"})
}
