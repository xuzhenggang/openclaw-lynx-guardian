package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/lynx-guardian/backend/internal/api"
	"github.com/openclaw/lynx-guardian/backend/internal/httpserver"
	"github.com/openclaw/lynx-guardian/backend/internal/repo"
)

func RegisterPolicy(router gin.IRoutes, repository *repo.PolicyRepository) {
	router.GET("/policies", func(c *gin.Context) {
		overview, err := repository.Overview(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, overview)
	})

	router.GET("/protected-resources", func(c *gin.Context) {
		values := c.Request.URL.Query()
		page, err := repository.ListProtectedResourcesPage(c.Request.Context(), repo.ProtectedResourceListQuery{
			Q:        httpserver.ReadString(values, "q"),
			Enabled:  httpserver.ReadBool(values, "enabled"),
			PageNum:  httpserver.ReadInt(values, "pageNum"),
			PageSize: httpserver.ReadInt(values, "pageSize"),
			Limit:    httpserver.ReadInt(values, "limit"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, page)
	})

	router.POST("/protected-resources", func(c *gin.Context) {
		var request api.ProtectedResourceUpsertRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"ok": false, "message": err.Error()})
			return
		}
		item, err := repository.UpsertProtectedResource(c.Request.Context(), request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, item)
	})

	router.GET("/policy-rules", func(c *gin.Context) {
		values := c.Request.URL.Query()
		page, err := repository.ListPolicyRulesPage(c.Request.Context(), repo.PolicyRuleListQuery{
			Q:           httpserver.ReadString(values, "q"),
			Kind:        httpserver.ReadString(values, "kind"),
			Scope:       httpserver.ReadString(values, "scope"),
			PatternType: httpserver.ReadString(values, "patternType"),
			Enabled:     httpserver.ReadBool(values, "enabled"),
			PageNum:     httpserver.ReadInt(values, "pageNum"),
			PageSize:    httpserver.ReadInt(values, "pageSize"),
			Limit:       httpserver.ReadInt(values, "limit"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, page)
	})

	router.POST("/policy-rules", func(c *gin.Context) {
		var request api.PolicyRuleUpsertRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"ok": false, "message": err.Error()})
			return
		}
		item, err := repository.UpsertPolicyRule(c.Request.Context(), request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, item)
	})
}
