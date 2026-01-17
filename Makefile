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
	@echo "📋 Installing schema globally (for CLI/Rust app)..."
	@ssh $(REMOTE_HOST) "mkdir -p .local/share/glib-2.0/schemas"
	@scp $(EXTENSION_DIR)/schemas/org.hati.Highlighter.gschema.xml $(REMOTE_HOST):.local/share/glib-2.0/schemas/
	@ssh $(REMOTE_HOST) "glib-compile-schemas .local/share/glib-2.0/schemas/"
	@echo "✅ Extension deployed & Schema installed globally."


deploy-frontend-remote: build-frontend
	@echo "🚀 Deploying frontend binary to $(REMOTE_HOST)..."
	@ssh $(REMOTE_HOST) "mkdir -p .local/bin"
	@scp $(FRONTEND_DIR)/target/release/hati $(REMOTE_HOST):.local/bin/
	@echo "✅ Frontend deployed. Run 'hati' on remote host to configure."

deploy-all-remote: deploy-remote deploy-frontend-remote
	@echo "🎉 Complete deployment finished!"



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
