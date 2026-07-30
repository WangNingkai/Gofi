package controller

import "gofi/application"

type Handler struct {
	Application *application.Application
}

func NewHandler(app *application.Application) *Handler {
	return &Handler{Application: app}
}
