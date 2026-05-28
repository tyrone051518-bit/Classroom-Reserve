package routers

import (
	JWT "template_school/pkg/middleware/jwt"
	SCHEDcontroller "template_school/pkg/services/dashboard/controller"
	svcHealthcheck "template_school/pkg/services/healthCheck"
	AUTHcontroller "template_school/pkg/services/login/controller"
	REGISTERcontroller "template_school/pkg/services/register/controller"

	"github.com/gofiber/fiber/v3"
)

func APIRoute(app *fiber.App) {

	publicV1 := app.Group("/api/public/v1")
	privateV1 := app.Group("/api/private/v1")

	// HealthCheck
	//Apit that be called of the FE/ FrontEnd
	publicV1.Get("/", svcHealthcheck.HealthCheck)
	privateV1.Get("/", svcHealthcheck.HealthCheck)

	//Call the function you made as endpoint or url
	auth := publicV1.Group("/authentication")
	auth.Post("/login", AUTHcontroller.Login)
	auth.Post("/register", REGISTERcontroller.Register)

	// Email verification endpoint
	auth.Get("/verify-email", REGISTERcontroller.VerifyEmail)

	// Ensure AUTHcontroller.Me exists in the controller package
	privateV1.Get("/me", JWT.AuthMiddleware, AUTHcontroller.Me)

	// Profile routes
	profile := privateV1.Group("/profile", JWT.AuthMiddleware)
	profile.Put("/update-name", AUTHcontroller.UpdateName)

	// Protect dashboard routes with JWT middleware
	dashboard := privateV1.Group("/dashboard", JWT.AuthMiddleware)

	// ONLY keep routes that definitely exist
	dashboard.Get("/active", SCHEDcontroller.GetActiveSchedule)
	dashboard.Post("/replace", SCHEDcontroller.ReplaceSchedule)
}
