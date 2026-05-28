package DBConnection

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/go-redis/redis/v8"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DBConnList  []*gorm.DB
	RedisClient *redis.Client
	RedisError  error
)

func PostgreSQLConnect() bool {
	// Use DATABASE_URL if set (Railway, Render, etc.)
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		if !strings.Contains(databaseURL, "sslmode=") {
			if strings.Contains(databaseURL, "?") {
				databaseURL += "&sslmode=require"
			} else {
				databaseURL += "?sslmode=require"
			}
		}

		dbConn, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
		if err != nil {
			log.Fatalf("FAILED TO CONNECT VIA DATABASE_URL: %v", err)
			return false
		}

		sqlDB, err := dbConn.DB()
		if err != nil {
			log.Fatalf("FAILED TO GET SQL INSTANCE: %v", err)
			return false
		}

		if err := sqlDB.Ping(); err != nil {
			log.Fatalf("FAILED TO PING DATABASE: %v", err)
			return false
		}

		fmt.Println("DATABASE CONNECTION STATUS: ✔ (via DATABASE_URL)")
		DBConnList = append(DBConnList, dbConn)
		return true
	}

	// Fallback: individual env vars (local dev)
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
			host, user, password, dbName, port, sslmode, timezone,
		)

		dbConn, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
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

		fmt.Printf("DATABASE %s CONNECTION STATUS: ✔\n", strings.ToUpper(dbName))
		DBConnList = append(DBConnList, dbConn)
	}

	fmt.Println("TIMEZONE CONFIGURED:", os.Getenv("DB_TIMEZONE"))
	return true
}

func GetDB() *gorm.DB {
	if len(DBConnList) == 0 {
		return nil
	}
	return DBConnList[0]
}
