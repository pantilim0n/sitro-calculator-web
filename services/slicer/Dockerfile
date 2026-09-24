FROM ubuntu:24.04
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip unzip libgl1 libegl1 libwebkit2gtk-4.1-0 && rm -rf /var/lib/apt/lists/*
COPY . /app
RUN pip3 install --break-system-packages -r requirements.txt
ENV PORT=8080
CMD ["python3","app.py"]
