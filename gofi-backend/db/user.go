package db

import "time"

const (
	AdminUsername = "admin"
)

type User struct {
	Id           int64     `json:"id"`
	RoleType     RoleType  `json:"roleType"`
	Username     string    `json:"username" validate:"required" xorm:"unique"`
	Password     string    `json:"-" validate:"required"`
	TokenVersion int64     `json:"-" xorm:"notnull default 0"`
	Created      time.Time `json:"-" xorm:"created"` // 创建时间
	Updated      time.Time `json:"-" xorm:"updated"` // 更新时间
}
