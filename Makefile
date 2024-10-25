BUILDDIR = waves.relint.de
INDEX = index.html
SRCS = src assets

$(BUILDDIR):
	mkdir -p $@

clean:
	rm -rf $(BUILDDIR)

release: $(BUILDDIR) $(SRCS)
	cp -f $(INDEX) $(BUILDDIR)
	cp -rf  $(SRCS) $(BUILDDIR)

serve:
	python -m http.server --bind 127.0.0.1 -d . 8080
