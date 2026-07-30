package db

import "time"

const CurrentSchemaVersion = 2

type SchemaMigration struct {
	ID        int64     `xorm:"pk"`
	Version   int       `xorm:"notnull"`
	UpdatedAt time.Time `xorm:"updated"`
}
