package emailService

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"time"
)

func GenerateVerificationToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate verification token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

func SendVerificationEmail(email string, verificationToken string) error {
	smtpHost     := os.Getenv("SMTP_HOST")
	smtpPort     := os.Getenv("SMTP_PORT")
	smtpUser     := os.Getenv("SMTP_USER")
	smtpPassword := os.Getenv("SMTP_PASSWORD")
	appName      := os.Getenv("PROJECT")
	appURL       := os.Getenv("APP_URL")
	backendURL   := os.Getenv("BACKEND_URL")

	if backendURL == "" {
		backendURL = "http://localhost:8080"
	}
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	if smtpHost == "" || smtpPort == "" || smtpUser == "" || smtpPassword == "" {
		return fmt.Errorf("SMTP configuration incomplete")
	}

	verificationLink := fmt.Sprintf("%s/api/public/v1/authentication/verify-email?token=%s", backendURL, verificationToken)

	subject := fmt.Sprintf("Verify Your Email - %s", appName)

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: Arial, sans-serif; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
		.button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
		.footer { background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Email Verification</h1>
		</div>
		<div class="content">
			<p>Hello,</p>
			<p>Thank you for registering with %s. Please verify your email address by clicking the button below:</p>
			<a href="%s" class="button">Verify Email</a>
			<p>Or copy and paste this link in your browser:</p>
			<p><a href="%s">%s</a></p>
			<p>This link will expire in 24 hours.</p>
			<p>If you did not register for this account, please ignore this email.</p>
		</div>
		<div class="footer">
			<p>&copy; %s. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
	`, appName, verificationLink, verificationLink, verificationLink, appName)

	message := []byte("To: " + email + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=\"utf-8\"\r\n" +
		"\r\n" +
		body)

	smtpAddress := fmt.Sprintf("%s:%s", smtpHost, smtpPort)

	conn, err := net.DialTimeout("tcp", smtpAddress, 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}

	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{ServerName: smtpHost}
	if err = client.StartTLS(tlsConfig); err != nil {
		return fmt.Errorf("failed to start TLS: %w", err)
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPassword, smtpHost)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed — check SMTP_USER and SMTP_PASSWORD: %w", err)
	}

	if err = client.Mail(smtpUser); err != nil {
		return fmt.Errorf("SMTP MAIL FROM failed: %w", err)
	}
	if err = client.Rcpt(email); err != nil {
		return fmt.Errorf("SMTP RCPT TO failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA failed: %w", err)
	}
	if _, err = w.Write(message); err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("failed to close email writer: %w", err)
	}

	return client.Quit()
}
