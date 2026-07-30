package db

import "time"

type Share struct {
	ID        int64     `json:"id" xorm:"pk autoincr"`
	TokenHash string    `json:"-" xorm:"unique notnull"`
	Path      string    `json:"path" xorm:"index notnull"`
	ExpiresAt time.Time `json:"expiresAt" xorm:"index"`
	Revoked   bool      `json:"revoked" xorm:"index"`
	CreatedAt time.Time `json:"createdAt" xorm:"created"`
}
