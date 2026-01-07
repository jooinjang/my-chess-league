package services

import (
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
)

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

func (s *UserService) GetAllUsers() ([]models.User, error) {
	var users []models.User
	result := database.DB.Find(&users)
	return users, result.Error
}

func (s *UserService) GetUserByID(id uint) (*models.User, error) {
	var user models.User
	result := database.DB.First(&user, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (s *UserService) CreateUser(req *models.CreateUserRequest) (*models.User, error) {
	user := models.User{
		Name:             req.Name,
		Memo:             req.Memo,
		ChesscomUsername: req.ChesscomUsername,
	}

	// 등록 시 초기 레이팅을 별도로 저장하고, 현재 레이팅도 그 값으로 시작
	if req.Rating != nil {
		user.InitialRating = *req.Rating
	} else {
		user.InitialRating = InitialRating
	}
	user.InitialRD = InitialRD

	user.Rating = user.InitialRating
	user.RatingDeviation = user.InitialRD

	result := database.DB.Create(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (s *UserService) UpdateUser(id uint, req *models.UpdateUserRequest) (*models.User, error) {
	var user models.User
	result := database.DB.First(&user, id)
	if result.Error != nil {
		return nil, result.Error
	}

	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Memo != nil {
		user.Memo = *req.Memo
	}
	if req.ChesscomUsername != nil {
		user.ChesscomUsername = req.ChesscomUsername
	}

	result = database.DB.Save(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (s *UserService) DeleteUser(id uint) error {
	// Use Unscoped() for hard delete instead of soft delete
	result := database.DB.Unscoped().Delete(&models.User{}, id)
	return result.Error
}

func (s *UserService) GetRankings() ([]models.User, error) {
	var users []models.User
	result := database.DB.Order("rating DESC").Find(&users)
	return users, result.Error
}
