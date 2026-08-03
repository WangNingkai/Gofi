package db

type Category string
type Name string

type Permission struct {
	RoleType RoleType `json:"roleType" xorm:"pk"` // 权限名称 主键，权限名唯一
	Name     Name     `json:"name" xorm:"pk"`     // 权限名称 主键，权限名唯一
	Category Category `json:"category"`           // 权限类别
	Enable   bool     `json:"enable"`
}

// 权限分类
const (
	PageAccess    Category = "PageAccess"    // 页面访问类型
	DataOperation Category = "DataOperation" // 数据操作类型
)

// 页面权限
const (
	FileListPageAccess Name = "FileListPageAccess" // 文件列表页访问权限
)

// 操作权限
const (
	FileUpload   Name = "FileUpload"   // 文件上传权限
	FileDownload Name = "FileDownload" // 文件下载权限
	FilePreview  Name = "FilePreview"  // 文件预览权限
	FileRemove   Name = "FileRemove"   // 文件删除权限
)

var guestPermissionMap = map[Category][]Name{
	PageAccess: {
		FileListPageAccess,
	},
	DataOperation: {
		FileUpload,
		FileDownload,
		FilePreview,
		FileRemove,
	},
}

func createGuestPermissions() []Permission {
	var permissions []Permission

	for category, names := range guestPermissionMap {
		for _, name := range names {
			permissions = append(permissions, Permission{
				RoleType: RoleTypeGuest,
				Name:     name,
				Category: category,
				Enable:   false,
			})
		}
	}
	return permissions
}

func SyncGuestPermissions() error {
	existing := make([]Permission, 0)
	err := engine.Where("role_type = ?", RoleTypeGuest).Find(&existing)
	if err != nil {
		return err
	}
	known := make(map[Name]bool, len(existing))
	for _, permission := range existing {
		known[permission.Name] = true
	}

	session := engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		return err
	}
	for _, permission := range createGuestPermissions() {
		if known[permission.Name] {
			continue
		}
		if _, err := session.InsertOne(&permission); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	return session.Commit()
}
