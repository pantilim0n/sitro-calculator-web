"""Relay new public Telegram posts to the SITRO website for MAX publishing."""
import base64
import hashlib
import hmac
import html
import json
import os
import re
from urllib.request import Request, urlopen

FOOTER = '\n\n📍 Липецк, ул. Свиридова, 9\n🌐 https://ситро-3д.рф\n📣 Telegram: https://t.me/sitro48\n🤖 Заказать в MAX: https://max.ru/se14469674_1_bot'


def clean_post_text(raw):
    raw = re.sub(r'<br\s*/?>', '\n', raw, flags=re.I)
    raw = re.sub(r'</?(?:p|blockquote)[^>]*>', '\n', raw, flags=re.I)
    text = html.unescape(re.sub(r'<[^>]+>', '', raw))
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if not any(marker in line.lower() for marker in ('ситро-3д.рф', 't.me/sitro48', 'ул. свиридова', '@sitrosupportbot'))]
    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    return text[:4000 - len(FOOTER)] + FOOTER


def parse_posts(source):
    parts = re.split(r'(?=<div class="tgme_widget_message [^\"]*" data-post="sitro48/)', source)
    posts = []
    for part in parts[1:]:
        found = re.search(r'data-post="sitro48/(\d+)"', part)
        if not found:
            continue
        date = re.search(r'<time datetime="([^\"]+)"', part)
        if not date or date.group(1) < '2026-01-01':
            continue
        text = re.search(r'<div class="tgme_widget_message_text[^\"]*"[^>]*>(.*?)</div>', part, re.S)
        photos = [html.unescape(url) for url in re.findall(r'<a class="[^\"]*tgme_widget_message_photo_wrap[^\"]*"[^>]*background-image:\s*url\((?:&quot;|[\'\"])(.+?)(?:&quot;|[\'\"])\)', part)]
        posts.append({'id': int(found.group(1)), 'text': clean_post_text(text.group(1) if text else ''), 'photos': photos})
    return sorted(posts, key=lambda post: post['id'])


def main():
    key = base64.b64decode(os.environ['TELEGRAM_RELAY_KEY'])
    if len(key) != 32:
        raise RuntimeError('Telegram relay key is invalid')
    request = Request('https://t.me/s/sitro48', headers={'User-Agent': 'Mozilla/5.0 SITRO channel sync'})
    with urlopen(request, timeout=30) as response:
        posts = parse_posts(response.read().decode())
    data = json.dumps({'posts': posts}, ensure_ascii=False, separators=(',', ':')).encode()
    signature = hmac.new(key, data, hashlib.sha256).hexdigest()
    relay = Request('https://ситро-3д.рф/api/telegram-to-max', data=data, headers={
        'Content-Type': 'application/json', 'X-Sitro-Relay-Signature': signature
    }, method='POST')
    with urlopen(relay, timeout=120) as response:
        result = json.load(response)
    print(f'Published {result["published"]} post(s); latest Telegram ID: {result["lastId"]}')


if __name__ == '__main__':
    main()
