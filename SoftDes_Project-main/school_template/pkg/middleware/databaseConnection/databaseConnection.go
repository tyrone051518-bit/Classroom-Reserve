package DBConnection

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DBConnList []*gorm.DB

	RedisClient *redis.Client
	RedisError  error
)

func PostgreSQLConnect() bool {

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	port := os.Getenv("DB_PORT")
	sslmode := os.Getenv("DB_SSLMODE")
	timezone := os.Getenv("DB_TIMEZONE")

	dbListRaw := os.Getenv("DB_LIST")
	dbNames := strings.Split(dbListRaw, ",")

	for _, dbName := range dbNames {

		dbName = strings.TrimSpace(dbName)

		if dbName == "" {
			continue
		}

		dsn := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
			host,
			user,
			password,
			dbName,
			port,
			sslmode,
			timezone,
		)

		dbConn, err := gorm.Open(
			postgres.Open(dsn),
			&gorm.Config{},
		)

		if err != nil {
			log.Fatalf("FAILED TO CONNECT TO %s: %v", dbName, err)
			return false
		}

		sqlDB, err := dbConn.DB()

		if err != nil {
			log.Fatalf("FAILED TO GET SQL INSTANCE FOR %s: %v", dbName, err)
			return false
		}

		if err := sqlDB.Ping(); err != nil {
			log.Fatalf("FAILED TO PING %s: %v", dbName, err)
			return false
		}

		fmt.Printf(
			"DATABASE %s CONNECTION STATUS: ✔\n",
			strings.ToUpper(dbName),
		)

		DBConnList = append(DBConnList, dbConn)
	}

	fmt.Println("TIMEZONE CONFIGURED:", timezone)

	return true
}

func GetDB() *gorm.DB {

	if len(DBConnList) == 0 {
		return nil
	}

	return DBConnList[0]
}
