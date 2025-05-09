import sqlite3
import json
from flask import Flask, request, jsonify, render_template, g

app = Flask(__name__, 
            static_folder='../website/static',
            template_folder='../website/templates')

DATABASE = 'wrongfully_convicted.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

# Routes for HTML pages
@app.route('/')
def home():
    return render_template('home.html', active_page='home')

@app.route('/browse')
def browse():
    return render_template('browse.html', active_page='browse')

@app.route('/exoneree/<int:exoneree_id>')
def exoneree_detail(exoneree_id):
    exoneree = query_db('SELECT * FROM exonerees WHERE id = ?', [exoneree_id], one=True)
    if exoneree is None:
        return "Exoneree not found", 404
    return render_template('exoneree_detail.html', active_page='browse', exoneree=exoneree)

@app.route('/resources')
def resources():
    # Get media types for filter options
    media_types = query_db('SELECT * FROM media_types ORDER BY name')
    
    # Get featured media resources (limit to 3)
    featured_resources = query_db('''
        SELECT m.*, mt.name as media_type, COUNT(em.exoneree_id) as exoneree_count
        FROM media_resources m
        JOIN media_types mt ON m.media_type_id = mt.id
        LEFT JOIN exoneree_media em ON m.id = em.media_id
        GROUP BY m.id
        ORDER BY exoneree_count DESC, m.publication_date DESC
        LIMIT 3
    ''')
    
    # Get all media resources with pagination
    page = request.args.get('page', 1, type=int)
    per_page = 12
    offset = (page - 1) * per_page
    
    media_resources = query_db(f'''
        SELECT m.*, mt.name as media_type, COUNT(em.exoneree_id) as exoneree_count
        FROM media_resources m
        JOIN media_types mt ON m.media_type_id = mt.id
        LEFT JOIN exoneree_media em ON m.id = em.media_id
        GROUP BY m.id
        ORDER BY m.title
        LIMIT {per_page} OFFSET {offset}
    ''')
    
    # Get total count for pagination
    media_count = query_db('SELECT COUNT(*) as count FROM media_resources', one=True)['count']
    total_pages = (media_count + per_page - 1) // per_page
    
    # Generate page numbers for pagination
    pages = range(1, total_pages + 1)
    
    return render_template('resources.html', 
                          active_page='resources',
                          media_types=media_types,
                          featured_resources=featured_resources,
                          media_resources=media_resources,
                          media_count=media_count,
                          current_page=page,
                          total_pages=total_pages,
                          pages=pages)

@app.route('/organizations')
def organizations():
    # Get organization types for filter options
    organization_types = query_db('''
        SELECT DISTINCT focus_area as id, focus_area as name 
        FROM organizations 
        WHERE focus_area IS NOT NULL
        ORDER BY focus_area
    ''')
    
    # Get states for filter options
    states = query_db('''
        SELECT DISTINCT state as id, state as name 
        FROM exonerees 
        WHERE state IS NOT NULL
        ORDER BY state
    ''')
    
    # Get services offered (using focus_area as a proxy since we don't have a dedicated services table)
    services = query_db('''
        SELECT DISTINCT focus_area as id, focus_area as name 
        FROM organizations 
        WHERE focus_area IS NOT NULL
        ORDER BY focus_area
    ''')
    
    # Get featured organizations (limit to 3)
    featured_organizations = query_db('''
        SELECT o.*, o.focus_area as org_type, 
               (SELECT COUNT(*) FROM exoneree_organizations WHERE organization_id = o.id) as exoneree_count,
               '' as city, '' as services
        FROM organizations o
        ORDER BY exoneree_count DESC
        LIMIT 3
    ''')
    
    # Add city and state from address field (simplified parsing)
    for org in featured_organizations:
        if org['address']:
            parts = org['address'].split(',')
            if len(parts) >= 2:
                org['city'] = parts[-2].strip()
                org['state'] = parts[-1].strip()
        
        # Add services as a list (using focus_area as a proxy)
        org['services'] = [{'id': 1, 'name': org['focus_area']}] if org['focus_area'] else []
    
    # Get all organizations with pagination
    page = request.args.get('page', 1, type=int)
    per_page = 12
    offset = (page - 1) * per_page
    
    organizations = query_db(f'''
        SELECT o.*, o.focus_area as org_type,
               (SELECT COUNT(*) FROM exoneree_organizations WHERE organization_id = o.id) as exoneree_count,
               '' as city, '' as services
        FROM organizations o
        ORDER BY o.name
        LIMIT {per_page} OFFSET {offset}
    ''')
    
    # Add city and state from address field for all organizations
    for org in organizations:
        if org['address']:
            parts = org['address'].split(',')
            if len(parts) >= 2:
                org['city'] = parts[-2].strip()
                org['state'] = parts[-1].strip()
        
        # Add services as a list (using focus_area as a proxy)
        org['services'] = [{'id': 1, 'name': org['focus_area']}] if org['focus_area'] else []
    
    # Get total count for pagination
    organization_count = query_db('SELECT COUNT(*) as count FROM organizations', one=True)['count']
    total_pages = (organization_count + per_page - 1) // per_page
    
    # Generate page numbers for pagination
    pages = range(1, total_pages + 1)
    
    return render_template('organizations.html', 
                          active_page='organizations',
                          organization_types=organization_types,
                          states=states,
                          services=services,
                          featured_organizations=featured_organizations,
                          organizations=organizations,
                          organization_count=organization_count,
                          current_page=page,
                          total_pages=total_pages,
                          pages=pages)

# API Routes for AJAX requests
@app.route('/api/exonerees')
def api_exonerees():
    # Get query parameters for filtering
    name = request.args.get('name', '')
    state = request.args.get('state', '')
    crime = request.args.get('crime', '')
    year_from = request.args.get('year_from', '')
    year_to = request.args.get('year_to', '')
    
    # Build query with filters
    query = 'SELECT * FROM exonerees WHERE 1=1'
    params = []
    
    if name:
        query += ' AND (first_name LIKE ? OR last_name LIKE ?)'
        params.extend(['%' + name + '%', '%' + name + '%'])
    
    if state:
        query += ' AND state = ?'
        params.append(state)
    
    if crime:
        query += ' AND worst_crime LIKE ?'
        params.append('%' + crime + '%')
    
    if year_from:
        query += ' AND exonerated_year >= ?'
        params.append(year_from)
    
    if year_to:
        query += ' AND exonerated_year <= ?'
        params.append(year_to)
    
    # Add pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    offset = (page - 1) * per_page
    
    query += f' ORDER BY last_name, first_name LIMIT {per_page} OFFSET {offset}'
    
    # Execute query
    exonerees = query_db(query, params)
    
    # Convert to list of dicts
    result = [dict(row) for row in exonerees]
    
    return jsonify(result)

@app.route('/api/media')
def api_media():
    # Get query parameters for filtering
    title = request.args.get('title', '')
    media_type = request.args.get('media_type', '')
    year_from = request.args.get('year_from', '')
    year_to = request.args.get('year_to', '')
    
    # Build query with filters
    query = '''
        SELECT m.*, mt.name as media_type, COUNT(em.exoneree_id) as exoneree_count
        FROM media_resources m
        JOIN media_types mt ON m.media_type_id = mt.id
        LEFT JOIN exoneree_media em ON m.id = em.media_id
        WHERE 1=1
    '''
    params = []
    
    if title:
        query += ' AND m.title LIKE ?'
        params.append('%' + title + '%')
    
    if media_type:
        query += ' AND mt.id = ?'
        params.append(media_type)
    
    if year_from:
        query += ' AND strftime("%Y", m.publication_date) >= ?'
        params.append(year_from)
    
    if year_to:
        query += ' AND strftime("%Y", m.publication_date) <= ?'
        params.append(year_to)
    
    query += ' GROUP BY m.id'
    
    # Add sorting
    sort = request.args.get('sort', 'title')
    if sort == 'title':
        query += ' ORDER BY m.title'
    elif sort == 'date-desc':
        query += ' ORDER BY m.publication_date DESC'
    elif sort == 'date-asc':
        query += ' ORDER BY m.publication_date ASC'
    elif sort == 'cases-desc':
        query += ' ORDER BY exoneree_count DESC'
    elif sort == 'cases-asc':
        query += ' ORDER BY exoneree_count ASC'
    
    # Add pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    offset = (page - 1) * per_page
    
    query += f' LIMIT {per_page} OFFSET {offset}'
    
    # Execute query
    media = query_db(query, params)
    
    # Convert to list of dicts
    result = [dict(row) for row in media]
    
    return jsonify(result)

@app.route('/api/organizations')
def api_organizations():
    # Get query parameters for filtering
    name = request.args.get('name', '')
    org_type = request.args.get('org_type', '')
    state = request.args.get('state', '')
    service = request.args.get('service', '')
    
    # Build query with filters
    query = '''
        SELECT o.*, o.focus_area as org_type,
               (SELECT COUNT(*) FROM exoneree_organizations WHERE organization_id = o.id) as exoneree_count,
               '' as city, '' as state
        FROM organizations o
        WHERE 1=1
    '''
    params = []
    
    if name:
        query += ' AND o.name LIKE ?'
        params.append('%' + name + '%')
    
    if org_type:
        query += ' AND o.focus_area = ?'
        params.append(org_type)
    
    if state or service:
        # These would require more complex queries with proper schema
        # For now, we'll handle these filters in Python after getting results
        pass
    
    # Add sorting
    sort = request.args.get('sort', 'name')
    if sort == 'name':
        query += ' ORDER BY o.name'
    elif sort == 'name-desc':
        query += ' ORDER BY o.name DESC'
    elif sort == 'type':
        query += ' ORDER BY o.focus_area'
    
    # Execute query
    organizations = query_db(query, params)
    
    # Convert to list of dicts
    result = []
    for org in organizations:
        org_dict = dict(org)
        
        # Parse address to get city and state
        if org_dict['address']:
            parts = org_dict['address'].split(',')
            if len(parts) >= 2:
                org_dict['city'] = parts[-2].strip()
                org_dict['state'] = parts[-1].strip()
        
        # Add services as a list (using focus_area as a proxy)
        org_dict['services'] = [{'id': 1, 'name': org_dict['focus_area']}] if org_dict['focus_area'] else []
        
        # Apply state filter if provided
        if state and (not org_dict.get('state') or state.lower() not in org_dict['state'].lower()):
            continue
        
        # Apply service filter if provided
        if service and (not org_dict['focus_area'] or service.lower() not in org_dict['focus_area'].lower()):
            continue
        
        result.append(org_dict)
    
    # Add pagination (after filtering)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    start = (page - 1) * per_page
    end = start + per_page
    
    # Return paginated results
    paginated_result = result[start:end]
    
    return jsonify({
        'organizations': paginated_result,
        'total': len(result)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
