FROM ubuntu:24.04 AS bambu
ARG BAMBU_VERSION=02.08.02.61
ARG BAMBU_APPIMAGE_URL="https://github.com/bambulab/BambuStudio/releases/download/v02.08.02.61/BambuStudio_ubuntu22.04-v02.08.02.61-20260820225108.AppImage"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl file git && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/bambu
# Bambu Studio is supplied as an AppImage URL at build time. Extracting it avoids FUSE in the container.
RUN test -n "$BAMBU_APPIMAGE_URL" && curl -fL "$BAMBU_APPIMAGE_URL" -o BambuStudio.AppImage \
 && chmod +x BambuStudio.AppImage \
 && ./BambuStudio.AppImage --appimage-extract \
 && mv squashfs-root app
# Pin the matching Bambu Studio source tree so the container has the official vendor profiles,
# including P1S/P2S machine, process and filament presets.
RUN git clone --depth 1 --branch v${BAMBU_VERSION} https://github.com/bambulab/BambuStudio.git /opt/bambu/source

FROM ubuntu:24.04
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
 ca-certificates python3 python3-pip libgl1 libegl1 libwebkit2gtk-4.1-0 libgtk-3-0 libdbus-1-3 \
 libx11-6 libxext6 libxrender1 libxi6 libxrandr2 libxkbcommon0 libfontconfig1 libfreetype6 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=bambu /opt/bambu/app /opt/bambu/app
COPY --from=bambu /opt/bambu/source/resources/profiles /opt/bambu/profiles
COPY . /app
RUN pip3 install --break-system-packages -r requirements.txt\nRUN mkdir -p /app/profiles && python3 /app/generate_profiles.py
ENV PORT=10000
ENV BAMBU_STUDIO_BIN=/opt/bambu/app/AppRun
ENV BAMBU_PROFILE_DIR=/opt/bambu/profiles/BBL
ENV SITRO_PROFILE_DIR=/app/profiles
CMD ["gunicorn","-b","0.0.0.0:10000","--timeout","240","app:app"]
