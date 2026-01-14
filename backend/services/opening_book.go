package services

import (
	"embed"
	"encoding/json"
	"sync"
)

// Opening detection uses a direct lookup:
//   openings.find(o => o.fen === fen.split(\" \")[0])
// where o.fen is the piece-placement part only.

//go:embed data/openings_map.json
var openingsFS embed.FS

type OpeningBookImpl struct {
	once sync.Once
	mu   sync.RWMutex
	m    map[string]string // piecePlacement -> opening name
	err  error
}

func NewOpeningBook() *OpeningBookImpl {
	return &OpeningBookImpl{}
}

func (b *OpeningBookImpl) init() {
	raw, err := openingsFS.ReadFile("data/openings_map.json")
	if err != nil {
		b.err = err
		return
	}
	m := map[string]string{}
	if err := json.Unmarshal(raw, &m); err != nil {
		b.err = err
		return
	}
	b.mu.Lock()
	b.m = m
	b.mu.Unlock()
}

func (b *OpeningBookImpl) LookupByPiecePlacement(piecePlacement string) (string, bool) {
	b.once.Do(b.init)
	if b.err != nil {
		return "", false
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	name, ok := b.m[piecePlacement]
	return name, ok
}


