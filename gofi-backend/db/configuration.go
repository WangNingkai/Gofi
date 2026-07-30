package db

import (
	"time"
)

type Configuration struct {
	Id                int64     `json:"-"`
	CustomStoragePath string    `json:"customStoragePath"` // 自定义文件仓库路径
	Initialized       bool      `json:"initialized"`       // 是否初始化
	Created           time.Time `json:"-" xorm:"created"`  // 创建时间
	Updated           time.Time `json:"-" xorm:"updated"`  // 更新时间
}
