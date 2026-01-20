.PHONY: all install-extension clean package deploy-remote

EXTENSION_UUID = hati@szymonwilczek.github.io
EXTENSION_DIR = extension
REMOTE_HOST = wolfie@dionisus.local
REMOTE_EXT_DIR = .local/share/gnome-shell/extensions/$(EXTENSION_UUID)


all: install-extension

# targets
install-extension:
	@echo "📦 Installing extension locally..."
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)
	@cp -r $(EXTENSION_DIR)/* ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)/
	@glib-compile-schemas ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)/schemas/
	@echo "✅ Extension installed. Restart GNOME Shell to apply."

# remote deployment (for testing on dionisus.local)
deploy-remote:
	@echo "🚀 Deploying extension to $(REMOTE_HOST)..."
	@ssh $(REMOTE_HOST) "mkdir -p '$(REMOTE_EXT_DIR)'"
	@scp -r $(EXTENSION_DIR)/* $(REMOTE_HOST):"$(REMOTE_EXT_DIR)/"
	@ssh $(REMOTE_HOST) "glib-compile-schemas '$(REMOTE_EXT_DIR)/schemas/'"
	@echo "✅ Extension deployed."

# packaging for extensions.gnome.org
package:
	@echo "📦 Creating extension package..."
	@mkdir -p dist
	@cd $(EXTENSION_DIR) && zip -r ../dist/$(EXTENSION_UUID).zip * -x "*.git*"
	@echo "✅ Package created: dist/$(EXTENSION_UUID).zip"

# cleanup
clean:
	@rm -rf $(EXTENSION_DIR)/schemas/gschemas.compiled
	@rm -rf dist
	@echo "✅ Clean complete."
