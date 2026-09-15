"""Rebuild short review excerpts from the source audio files in ignored work/creature-audio.

Run from any directory. Pass --fetch to retrieve missing source recordings with
an installed yt-dlp for YouTube, or the recorded direct/ZIP download for other
sources. Full recordings remain outside the review artifact.
"""
from pathlib import Path
from array import array
import argparse
import hashlib
import json
import math
import subprocess
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work' / 'creature-audio'


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs)


def samples(path):
    result = run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1',
                  '-ar', '48000', '-f', 'f32le', '-'])
    values = array('f')
    values.frombytes(result.stdout)
    return values


def source_audio(clip, fetch):
    source = clip['source']
    acquisition = clip.get('sourceAudio', {})
    relative = acquisition.get('workPath')
    if not relative:
        if not source.get('videoId'):
            raise ValueError(f'Missing sourceAudio.workPath for {clip["id"]}')
        relative = source['videoId'] + '.wav'
    original = (WORK / relative).resolve()
    if not original.is_relative_to(WORK.resolve()):
        raise ValueError(f'Source path is outside the work directory: {relative}')
    if original.exists():
        return original
    if not fetch:
        raise SystemExit(f'Missing {original}; rerun with --fetch to retrieve source audio.')
    original.parent.mkdir(parents=True, exist_ok=True)
    direct_url = acquisition.get('downloadUrl')
    archive_url = acquisition.get('archiveUrl')
    refresh_url = acquisition.get('refreshUrl')
    if refresh_url:
        if not refresh_url.startswith(('https://', 'http://')):
            raise ValueError('Source refresh URLs must use HTTP or HTTPS')
        request = urllib.request.Request(refresh_url, headers={'User-Agent': 'BurningTokensAudioStudy/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            refreshed = json.load(response)
        row = refreshed['rows'][0]['row']
        if row.get('file_path') != acquisition.get('datasetFilePath'):
            raise ValueError(f'Dataset row no longer matches the recorded source for {clip["id"]}')
        direct_url = row['audio'][0]['src']
    if direct_url or archive_url:
        url = direct_url or archive_url
        if not url.startswith(('https://', 'http://')):
            raise ValueError('Source downloads must use HTTP or HTTPS')
        request = urllib.request.Request(url, headers={'User-Agent': 'BurningTokensAudioStudy/1.0'})
        if archive_url:
            archive_path = WORK / ('source-' + hashlib.sha256(url.encode()).hexdigest()[:16] + '.zip')
            if not archive_path.exists():
                with urllib.request.urlopen(request, timeout=45) as response:
                    archive_path.write_bytes(response.read())
            with zipfile.ZipFile(archive_path) as archive:
                original.write_bytes(archive.read(acquisition['archiveMember']))
        else:
            with urllib.request.urlopen(request, timeout=45) as response:
                original.write_bytes(response.read())
    elif source.get('videoId'):
        run(['yt-dlp', '--ignore-config', '--no-playlist', '-f', 'bestaudio',
             '-x', '--audio-format', 'wav', '--no-progress', '--no-mtime',
             '-o', str(WORK / '%(id)s.%(ext)s'), source['url']])
    elif acquisition.get('downloadPage'):
        raise SystemExit(f'Download the original from {acquisition["downloadPage"]} and save its recorded member to {original}')
    else:
        raise ValueError(f'No recorded download URL for {clip["id"]}')
    return original


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--source', help='Only rebuild excerpts from this source ID or YouTube video ID')
    options = parser.parse_args()
    manifest = json.loads((HERE / 'clips.json').read_text())
    snapshot = json.loads((HERE / 'reviewed-2026-09-15-round-four.json').read_text())
    protected_ids = {id for id, review in snapshot['reviews'].items() if review.get('favorite')}
    WORK.mkdir(parents=True, exist_ok=True)
    (HERE / 'clips').mkdir(exist_ok=True)
    report = []
    for clip in manifest['clips']:
        source = clip['source']
        if options.source and options.source not in (source.get('videoId'), source.get('id')):
            continue
        destination = HERE / clip['src']
        if clip['id'] in protected_ids and destination.exists():
            print(f'{clip["id"]}: preserved reviewed favorite')
            continue
        original = source_audio(clip, options.fetch)
        length = source['end'] - source['start']
        if not math.isfinite(length) or length <= 0 or length > 15:
            raise ValueError(f'Invalid review excerpt duration for {clip["id"]}')
        raw = run(['ffmpeg', '-v', 'error', '-ss', str(source['start']),
                   '-t', str(length), '-i', str(original), '-ac', '1',
                   '-ar', '48000', '-f', 'f32le', '-']).stdout
        data = array('f')
        data.frombytes(raw)
        peak = max(map(abs, data), default=0)
        if not peak or not all(math.isfinite(v) for v in data):
            raise ValueError(f'Silent or invalid audio for {clip["id"]}')
        gain = 10 ** (-6 / 20) / peak
        destination = HERE / clip['src']
        fades = clip.get('fades', {})
        fade_in = fades.get('inMs', 12) / 1000
        fade_out = fades.get('outMs', 35) / 1000
        if not all(math.isfinite(v) and v > 0 for v in (fade_in, fade_out)) or fade_in + fade_out >= length:
            raise ValueError(f'Invalid fade durations for {clip["id"]}')
        effects = (f'volume={gain:.9f},afade=t=in:d={fade_in:.6f},'
                   f'afade=t=out:st={length - fade_out:.6f}:d={fade_out:.6f}')
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '48000',
             '-ac', '1', '-i', '-', '-af', effects, '-codec:a', 'libmp3lame',
             '-b:a', '128k', '-map_metadata', '-1', str(destination)], input=raw)
        decoded = samples(destination)
        output_peak = max(map(abs, decoded))
        peak_db = 20 * math.log10(output_peak)
        rms = math.sqrt(sum(v * v for v in decoded) / len(decoded))
        if not all(math.isfinite(v) for v in decoded) or peak_db > -3 or rms < 0.001:
            raise ValueError(f'Unexpected level in {clip["id"]}: {peak_db:.2f} dBFS, RMS {rms}')
        clip['duration'] = round(len(decoded) / 48000, 3)
        clip['processing'] = (f'Isolated excerpt; {fade_in * 1000:g} ms in / {fade_out * 1000:g} ms out fades; '
                              'peak matched to −6 dBFS before MP3 encoding. Original pitch and speed.')
        clip['audio'] = {'format': 'MP3', 'sampleRate': 48000, 'channels': 1,
                         'bitrate': 128000, 'peakDbfs': round(peak_db, 2),
                         'gainDb': round(20 * math.log10(gain), 2),
                         'bytes': destination.stat().st_size,
                         'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
        report.append(f'{clip["id"]}: {clip["duration"]:.3f}s, peak {peak_db:.2f} dBFS')
    (HERE / 'clips.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    print('\n'.join(report))
    print(f'{len(report)} clips exported and decoded successfully')


if __name__ == '__main__':
    main()
