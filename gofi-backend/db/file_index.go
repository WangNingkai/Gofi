package db

import "time"

type FileIndex struct {
	ID          int64     `json:"-" xorm:"pk autoincr"`
	Path        string    `json:"path" xorm:"unique notnull"`
	Name        string    `json:"name" xorm:"index notnull"`
	IsDirectory bool      `json:"isDirectory" xorm:"index"`
	Size        int64     `json:"size"`
	Modified    int64     `json:"modified"`
	Content     string    `json:"-" xorm:"text"`
	Updated     time.Time `json:"-" xorm:"updated"`
}
