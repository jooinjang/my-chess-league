package main

import (
	"encoding/json"
	"fmt"
	"log"
	
	"github.com/gorilla/websocket"
)

type chessAPIRequest struct {
	FEN            string `json:"fen,omitempty"`
	Variants       int    `json:"variants,omitempty"`
	Depth          int    `json:"depth,omitempty"`
	MaxThinkingTime int   `json:"maxThinkingTime,omitempty"`
}

func main() {
	url := "wss://chess-api.com/v1"
	fmt.Printf("Connecting to %s...\n", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatalf("dial: %v", err)
	}
	defer c.Close()

	req := chessAPIRequest{
		FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
		Variants: 3,
		Depth: 10,
        MaxThinkingTime: 50,
	}
	
	b, _ := json.Marshal(req)
	if err := c.WriteMessage(websocket.TextMessage, b); err != nil {
		log.Fatal("write:", err)
	}
	
	fmt.Println("Sent request, waiting for messages...")
	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			return
		}
		
        var m map[string]interface{}
        if err := json.Unmarshal(message, &m); err == nil {
            fmt.Printf("Type: %v\n", m["type"])
            // print specific fields if they exist
            if _, ok := m["depth"]; ok {
                 fmt.Printf("  Has depth: %v\n", m["depth"])
            }
            if _, ok := m["centipawns"]; ok {
                 fmt.Printf("  Has cp: %v\n", m["centipawns"])
            }
            if _, ok := m["move"]; ok {
                 fmt.Printf("  Has move: '%v'\n", m["move"])
            }
            if _, ok := m["continuationArr"]; ok {
                 fmt.Printf("  Has continuationArr: %v\n", m["continuationArr"])
            }
        } else {
		    fmt.Printf("Received: %s\n", message)
        }
        
        if t, ok := m["type"].(string); ok && t == "bestmove" {
            break
        }
	}
}
