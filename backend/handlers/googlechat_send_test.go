package handlers

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGoogleChatSend_RequiresWebhookURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("GOOGLE_CHAT_WEBHOOK_URL", "")

	r := gin.New()
	r.POST("/api/v1/googlechat/send", GoogleChatSend)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/googlechat/send", bytes.NewBufferString(`{"text":"Hi"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestGoogleChatSend_SendsWebhook(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Fake Google Chat webhook server
	got := make(chan string, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		b, _ := io.ReadAll(r.Body)
		got <- string(b)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"name":"x","text":"Hi"}`))
	}))
	defer ts.Close()

	// Ensure env is set for this process (GetConfig reads from os.Getenv)
	_ = os.Setenv("GOOGLE_CHAT_WEBHOOK_URL", ts.URL)
	t.Cleanup(func() { _ = os.Unsetenv("GOOGLE_CHAT_WEBHOOK_URL") })

	r := gin.New()
	r.POST("/api/v1/googlechat/send", GoogleChatSend)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/googlechat/send", bytes.NewBufferString(`{"text":"Hi"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}

	select {
	case body := <-got:
		if body != `{"text":"Hi"}` {
			t.Fatalf("unexpected webhook payload: %q", body)
		}
	default:
		t.Fatalf("expected webhook to be called")
	}
}


