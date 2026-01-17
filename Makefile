.PHONY: all install-extension build-frontend install-frontend clean package deploy-remote

EXTENSION_UUID = [email protected]
EXTENSION_DIR = extension
FRONTEND_DIR = frontend
REMOTE_HOST = wolfie@dionisus.local
REMOTE_EXT_DIR = .local/share/gnome-shell/extensions/$(EXTENSION_UUID)


all: install-extension build-frontend

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
	@echo "✅ Extension deployed to remote host. Logout/login on dionisus to apply."


# frontend targets
build-frontend:
	@echo "🦀 Building Rust frontend..."
	@cd $(FRONTEND_DIR) && cargo build --release
	@echo "✅ Frontend built."

install-frontend: build-frontend
	@echo "📦 Installing frontend binary..."
	@mkdir -p ~/.local/bin
	@cp $(FRONTEND_DIR)/target/release/hati ~/.local/bin/
	@echo "✅ Frontend installed to ~/.local/bin/hati"

# packaging for extensions.gnome.org
package:
	@echo "📦 Creating extension package..."
	@mkdir -p dist
	@cd $(EXTENSION_DIR) && zip -r ../dist/$(EXTENSION_UUID).zip * -x "*.git*"
	@echo "✅ Package created: dist/$(EXTENSION_UUID).zip"

# cleanup
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf $(FRONTEND_DIR)/target
	@rm -rf $(EXTENSION_DIR)/schemas/gschemas.compiled
	@rm -rf dist
	@echo "✅ Clean complete."
