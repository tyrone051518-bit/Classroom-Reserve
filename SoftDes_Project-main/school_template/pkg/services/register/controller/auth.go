package REGISTERcontroller

import (
	"fmt"
	"os"

	"template_school/pkg/middleware/helper"
	REGISTERmodels "template_school/pkg/services/register/models"
	REGISTERscript "template_school/pkg/services/register/script"

	"github.com/FDSAP-Git-Org/hephaestus/respcode"
	"github.com/gofiber/fiber/v3"
)

func Register(c fiber.Ctx) error {

	// 1. Request Body
	requestBody := REGISTERmodels.RequestBody{}

	if reqErr := c.Bind().Body(&requestBody); reqErr != nil {
		return helper.JSONResponseWithError(
			c.Status(400),
			respcode.ERR_CODE_400,
			respcode.ERR_CODE_400_MSG,
			reqErr,
		)
	}

	// 2. Call register service
	user, err := REGISTERscript.RegisterUser(requestBody)

	if err != nil {
		return helper.JSONResponseWithError(
			c.Status(400),
			respcode.ERR_CODE_400,
			err.Error(),
			err,
		)
	}

	// 3. Success response
	return helper.JSONResponseWithData(
		c,
		respcode.SUC_CODE_200,
		"Registration successful",
		user,
	)
}

// VerifyEmail handles verification links from email. Expects query param `token`.
func VerifyEmail(c fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return helper.JSONResponseWithError(
			c.Status(400),
			respcode.ERR_CODE_400,
			"verification token is required",
			fmt.Errorf("missing token"),
		)
	}

	user, err := REGISTERscript.VerifyEmailToken(token)
	if err != nil {
		return helper.JSONResponseWithError(
			c.Status(400),
			respcode.ERR_CODE_400,
			err.Error(),
			err,
		)
	}

	// Redirect to frontend login if APP_URL is set, otherwise return JSON success
	appURL := os.Getenv("APP_URL")
	if appURL != "" {
		// Some project Fiber bindings use a different Redirect signature.
		// Set Location header and status manually to be compatible.
		c.Status(302)
		c.Set("Location", fmt.Sprintf("%s/login?verified=1", appURL))
		return nil
	}

	return helper.JSONResponseWithData(
		c,
		respcode.SUC_CODE_200,
		"Email verified",
		user,
	)
}
