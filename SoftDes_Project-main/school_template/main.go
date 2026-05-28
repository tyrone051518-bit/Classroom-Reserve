package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	DBConnection "template_school/pkg/middleware/databaseConnection"
	routers "template_school/routes"

	"github.com/FDSAP-Git-Org/hephaestus/apilogs"
	utils_v1 "github.com/FDSAP-Git-Org/hephaestus/utils/v1"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"
)

func init() {
	// 1. Load environment name
	env := utils_v1.GetEnv("ENVIRONMENT")
	if env == "" {
		env = "local"
	}
	env = strings.ToLower(env)

	fmt.Println("ENVIRONMENT:", strings.ToUpper(env))

	envPath := fmt.Sprintf("./envs/.env-%s", env)
	if err := godotenv.Load(envPath); err != nil {
		log.Printf("env file not found: %s\n", envPath)
	}

	fmt.Println("PROJECT:", utils_v1.GetEnv("PROJECT"))
	fmt.Println("DESCRIPTION:", utils_v1.GetEnv("DESCRIPTION"))

	apilogs.CreateInitialFolder([]string{"system"})

	if ok := DBConnection.PostgreSQLConnect(); !ok {
		log.Fatal("failed to connect to database")
	}
}

func main() {
	// Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName:          utils_v1.GetEnv("PROJECT"),
		CaseSensitive:    true,
		DisableKeepalive: false,
		JSONEncoder:      json.Marshal,
		JSONDecoder:      json.Unmarshal,
	})

	// Middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "Authorization"},
		AllowCredentials: false,
	}))

	app.Use(logger.New())
	app.Use(recover.New())

	// Initialize API Endpoints
	routers.APIRoute(app)

	// Start Server
	port := utils_v1.GetEnv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("server running on port %s\n", port)
	log.Fatal(app.Listen(fmt.Sprintf(":%s", port)))
}
