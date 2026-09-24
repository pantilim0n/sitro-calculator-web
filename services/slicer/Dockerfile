FROM ubuntu:24.04 AS bambu
ARG BAMBU_VERSION=02.04.00.70
ARG BAMBU_APPIMAGE_URL=""
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl file && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/bambu
# Bambu Studio is supplied as an AppImage URL at build time. Extracting it avoids FUSE in the container.
RUN test -n "$BAMBU_APPIMAGE_URL" && curl -fL "$BAMBU_APPIMAGE_URL" -o BambuStudio.AppImage \
 && chmod +x BambuStudio.AppImage \
 && ./BambuStudio.AppImage --appimage-extract \
 && mv squashfs-root app

FROM ubuntu:24.04
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
 ca-certificates python3 python3-pip libgl1 libegl1 libwebkit2gtk-4.1-0 libgtk-3-0 libdbus-1-3 \
 libx11-6 libxext6 libxrender1 libxi6 libxrandr2 libxkbcommon0 libfontconfig1 libfreetype6 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=bambu /opt/bambu/app /opt/bambu/app
COPY . /app
RUN pip3 install --break-system-packages -r requirements.txt
ENV PORT=10000
ENV BAMBU_STUDIO_BIN=/opt/bambu/app/AppRun
ENV SITRO_PROFILE_DIR=/app/profiles
CMD ["gunicorn","-b","0.0.0.0:10000","--timeout","240","app:app"]
