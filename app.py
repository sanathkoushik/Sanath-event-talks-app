import os
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

ATOM_NS = '{http://www.w3.org/2005/Atom}'

# Simple memory cache
cache = {
    'data': None,
    'expiry': 0
}

def fetch_and_parse_feed():
    now = time.time()
    # If cache is valid, return cached data
    if cache['data'] and cache['expiry'] > now:
        return cache['data']
        
    url = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityFeedReader/1.0'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        
        # Get feed updated time
        feed_updated = ''
        updated_elem = root.find(f'{ATOM_NS}updated')
        if updated_elem is not None:
            feed_updated = updated_elem.text
            
        entries = []
        for entry in root.findall(f'{ATOM_NS}entry'):
            title_elem = entry.find(f'{ATOM_NS}title')
            updated_elem = entry.find(f'{ATOM_NS}updated')
            content_elem = entry.find(f'{ATOM_NS}content')
            
            # Find alternate link or first link
            link_elem = entry.find(f"{ATOM_NS}link[@rel='alternate']")
            if link_elem is None:
                link_elem = entry.find(f'{ATOM_NS}link')
                
            date = title_elem.text if title_elem is not None else ''
            updated = updated_elem.text if updated_elem is not None else ''
            content = content_elem.text if content_elem is not None else ''
            link = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            entries.append({
                'date': date,
                'updated': updated,
                'content': content,
                'link': link
            })
            
        result = {
            'status': 'success',
            'feed_updated': feed_updated,
            'entries': entries,
            'cached_at': now
        }
        
        # Cache for 5 minutes (300 seconds)
        cache['data'] = result
        cache['expiry'] = now + 300
        return result
        
    except Exception as e:
        # If fetch fails but we have cached data (even if expired), fallback to it
        if cache['data']:
            return cache['data']
        return {
            'status': 'error',
            'message': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes():
    return jsonify(fetch_and_parse_feed())

@app.route('/api/release-notes/refresh')
def force_refresh_notes():
    # Explicitly clear cache and refetch
    cache['data'] = None
    cache['expiry'] = 0
    return jsonify(fetch_and_parse_feed())

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
