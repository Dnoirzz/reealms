import requests
from bs4 import BeautifulSoup
import json
import time
import random
from urllib.parse import urljoin

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Referer': 'https://otakudesu.blog/',
}

def get_soup(url):
    time.sleep(random.uniform(3, 7))  # Delay biar mirip manusia, kurangi risiko block
    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        return BeautifulSoup(r.text, 'html.parser')
    except Exception as e:
        print(f"Error akses {url}: {e}")
        return None

def extract_720p_from_episode(episode_url):
    soup = get_soup(episode_url)
    if not soup:
        return None

    data = {'episode_url': episode_url, '720p_mp4': None, '720p_mkv': None, 'other_720p': None}

    # Cari semua <p> atau <div> yang punya text resolusi
    for p in soup.find_all(['p', 'div']):
        text = p.get_text(strip=True).lower()
        if '720p' in text or '720' in text:
            # Cari link <a> di dalam atau sibling
            links = p.find_all('a') or p.parent.find_all('a') if p.parent else []
            for a in links:
                href = a.get('href', '')
                link_text = a.get_text(strip=True).lower()
                if not href:
                    continue
                href = urljoin(episode_url, href)
                if 'mp4' in link_text or 'mp4' in href:
                    data['720p_mp4'] = href
                elif 'mkv' in link_text or 'mkv' in href:
                    data['720p_mkv'] = href
                elif '720' in link_text:
                    data['other_720p'] = href

            # Kalau ketemu satu aja, break biar cepat (prioritas MP4)
            if data['720p_mp4'] or data['720p_mkv']:
                break

    # Kalau nggak ketemu di download section, coba cari di iframe / player (opsional level 2)
    if not (data['720p_mp4'] or data['720p_mkv']):
        iframe = soup.find('iframe')
        if iframe and iframe.get('src'):
            player_url = urljoin(episode_url, iframe['src'])
            player_soup = get_soup(player_url)
            if player_soup:
                video = player_soup.find('video')
                if video and video.get('src'):
                    src = urljoin(player_url, video['src'])
                    if '.mp4' in src:
                        data['720p_mp4'] = src

    return data if data['720p_mp4'] or data['720p_mkv'] else None

def scrape_anime_720p(anime_url, limit_episode=5):
    soup = get_soup(anime_url)
    if not soup:
        return []

    results = []
    # Cari link episode di list (biasanya <a> dengan href /episode/...)
    episode_links = soup.select('a[href*="/episode/"]')
    seen_urls = set()

    for link in episode_links:
        ep_url = urljoin(anime_url, link.get('href', ''))
        if '/episode/' not in ep_url or ep_url in seen_urls:
            continue
        seen_urls.add(ep_url)

        title = link.get_text(strip=True) or "Episode unknown"
        video_data = extract_720p_from_episode(ep_url)
        if video_data:
            best_link = video_data['720p_mp4'] or video_data['720p_mkv'] or video_data['other_720p']
            if best_link:
                results.append({
                    'title': title,
                    'episode_url': ep_url,
                    '720p_link': best_link,
                    'type': 'mp4' if video_data['720p_mp4'] else 'mkv'
                })
                print(f"Berhasil ambil: {title} → {best_link}")

        if len(results) >= limit_episode:
            break

        time.sleep(random.uniform(2, 5))  # Delay antar episode

    return results

# ------------------- JALANKAN DI SINI -------------------
if __name__ == "__main__":
    # Ganti dengan anime yang kamu mau
    anime_url = "https://otakudesu.blog/anime/maou-musume-yasashisugiru-sub-indo/"
    # anime_url = "https://otakudesu.blog/anime/oshi-ko-s3-sub-indo/"  # contoh lain

    hasil = scrape_anime_720p(anime_url, limit_episode=3)  # Ambil 3 episode dulu buat test

    print("\nHasil Scraping (JSON):")
    print(json.dumps(hasil, indent=2, ensure_ascii=False))

    if hasil:
        print("\nLink 720p siap pakai di Flutter:")
        for item in hasil:
            print(f"- {item['title']}: {item['720p_link']}")