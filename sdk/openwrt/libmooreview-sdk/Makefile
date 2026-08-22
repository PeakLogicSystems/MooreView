#
# OpenWrt package: libmooreview-sdk
# Copy this directory into your OpenWrt feed as package/libmooreview-sdk
#

include $(TOPDIR)/rules.mk

PKG_NAME:=libmooreview-sdk
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=file://$(CURDIR)/../../..
PKG_SOURCE_VERSION:=HEAD
PKG_SOURCE_SUBDIR:=sdk
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz

include $(INCLUDE_DIR)/package.mk

define Package/libmooreview-sdk
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=MooreVIEW C++ HTTP SDK
  DEPENDS:=+libcurl +libstdcpp
endef

define Package/libmooreview-sdk/description
  C++ client library for MooreVIEW embedded runtime (:3080).
  For OpenWrt MIPS and other embedded Linux targets.
endef

CMAKE_OPTIONS += \
	-DMOOREVIEW_SDK_BUILD_EXAMPLES=OFF \
	-DMOOREVIEW_SDK_BUILD_SHARED=ON

define Package/libmooreview-sdk/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_BUILD_DIR)/libmooreview_sdk.so* $(1)/usr/lib/ 2>/dev/null || \
		$(CP) $(PKG_BUILD_DIR)/libmooreview_sdk.a $(1)/usr/lib/
	$(INSTALL_DIR) $(1)/usr/include/mooreview
	$(CP) $(PKG_BUILD_DIR)/../include/mooreview/*.hpp $(1)/usr/include/mooreview/
endef

$(eval $(call BuildPackage,libmooreview-sdk))
