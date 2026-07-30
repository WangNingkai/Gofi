package repository

import (
	"time"

	"gofi/db"

	"github.com/go-xorm/xorm"
)

type ShareRepository interface {
	Create(share *db.Share) error
	List() ([]db.Share, error)
	GetActive(tokenHash string, now time.Time) (*db.Share, error)
	Revoke(id int64) error
}

type shareRepository struct {
	engine *xorm.Engine
}

func NewShareRepository(engine *xorm.Engine) ShareRepository {
	return &shareRepository{engine: engine}
}

func (repository *shareRepository) Create(share *db.Share) error {
	_, err := repository.engine.InsertOne(share)
	return err
}

func (repository *shareRepository) List() ([]db.Share, error) {
	shares := make([]db.Share, 0)
	err := repository.engine.Desc("id").Find(&shares)
	return shares, err
}

func (repository *shareRepository) GetActive(tokenHash string, now time.Time) (*db.Share, error) {
	share := new(db.Share)
	found, err := repository.engine.Where(
		"token_hash = ? AND revoked = ? AND expires_at > ?",
		tokenHash, false, now,
	).Get(share)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return share, nil
}

func (repository *shareRepository) Revoke(id int64) error {
	affected, err := repository.engine.ID(id).Cols("revoked").Update(&db.Share{Revoked: true})
	if err != nil {
		return err
	}
	if affected == 0 {
		return db.ErrRecordNotFound
	}
	return nil
}
