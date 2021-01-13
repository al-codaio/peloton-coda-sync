# One-way data sync from Peloton API to Coda in Python
# Author: Al Chen (al@coda.io)
# Last Updated: January 12th, 2021
# Writeup and copyable template here: https://coda.io/@atc/analyze-your-peloton-workout-stats-with-real-time-updates

################# Setup and global variables ###########

api_key = 'YOUR_CODA_API_KEY'
coda_doc_id = 'YOUR_CODA_DOC_ID'
peloton_username = 'YOUR_PELOTON_USERNAME'
peloton_pw = 'YOUR_PELOTON_PASSWORD'

########################################################

import requests
import json

# Current workout IDs
table_name = 'Workouts'
headers = {'Authorization': 'Bearer ' + api_key}
current_workout_ids = []
current_rows_uri = 'https://coda.io/apis/v1/docs/' + coda_doc_id + '/tables/' + table_name + '/rows'
current_rows = requests.get(current_rows_uri, headers=headers, params={})
for workout_id in current_rows.json()['items']:
	current_workout_ids.append(workout_id['name'])

# Get workouts from Peloton API
s = requests.Session()
base_url = 'https://api.onepeloton.com'
payload = {'username_or_email': peloton_username, 'password': peloton_pw}
s.post(base_url + '/auth/login', json=payload)
userID = s.get(base_url + '/api/me').json()['id']
workouts = json.loads(json.dumps(s.get(base_url + '/api/user/' + userID + '/workouts?limit=1000').json()).replace('null', '""'))
workout_data = {}
for workout in workouts['data']:
	workout_id = workout['id']
	workout_data[workout_id] = {}
	workout_summary = json.loads(json.dumps(s.get(base_url + '/api/workout/' + workout_id).json()).replace('null', '""'))
	workout_performance = json.loads(json.dumps(s.get(base_url + '/api/workout/' + workout_id + '/performance_graph?every_n=1000').json()).replace('null', '""'))
	workout_data[workout_id]['summary'] = workout_summary	
	workout_data[workout_id]['performance'] = workout_performance

# Get net new workouts
for workout_id in current_workout_ids:
	if workout_id in workout_data:
		workout_data.pop(workout_id)

# Push new workouts to Coda
rows = []
for key, values in workout_data.items():
	cells = []
	if values['performance']['average_summaries']: # for bike workouts
		cells.extend((
			{'column': 'Workout ID',          'value': key},
			{'column': 'Date', 				  'value': values['summary']['created_at']},
	        {'column': 'Workout Type', 		  'value': values['summary']['fitness_discipline']},
	        {'column': 'Difficulty', 		  'value': values['summary']['ride']['difficulty_estimate']},
	        {'column': 'Duration', 			  'value': values['summary']['ride']['duration']},
	        {'column': 'Class Thumbnail', 	  'value': values['summary']['ride']['image_url']},
	        {'column': 'Instructor ID', 	  'value': values['summary']['ride']['instructor_id']},
	        {'column': 'Total Ratings', 	  'value': values['summary']['ride']['overall_rating_count']},
	        {'column': 'Workout Name', 		  'value': values['summary']['ride']['title']},
	        {'column': 'Total Workouts', 	  'value': values['summary']['ride']['total_workouts']},
	        {'column': 'Start Time', 		  'value': values['summary']['start_time']},
	        {'column': 'Leaderboard Rank',    'value': values['summary']['leaderboard_rank']},
	        {'column': 'Leaderboard Users',   'value': values['summary']['total_leaderboard_users']},
	        {'column': 'Status', 			  'value': values['summary']['status']},
	        {'column': 'Workout Description', 'value': values['summary']['ride']['description']},
	        {'column': 'Avg Output (kj)', 	  'value': values['performance']['average_summaries'][0]['value']},
	        {'column': 'Avg Cadence', 		  'value': values['performance']['average_summaries'][1]['value']},
	        {'column': 'Avg Resistance',      'value': values['performance']['average_summaries'][2]['value']},
	        {'column': 'Avg Speed (mph)',     'value': values['performance']['average_summaries'][3]['value']},
	        {'column': 'Total Output (kj)',   'value': values['performance']['summaries'][0]['value']},
	        {'column': 'Distance (mi)', 	  'value': values['performance']['summaries'][1]['value']},
	        {'column': 'Calories (kcal)',     'value': values['performance']['summaries'][2]['value']}
		))
	else:  # for non-bike workouts
		cells.extend((
			{'column': 'Workout ID',          'value': key},
			{'column': 'Date', 				  'value': values['summary']['created_at']},
	        {'column': 'Workout Type', 		  'value': values['summary']['fitness_discipline']},
	        {'column': 'Difficulty', 		  'value': values['summary']['ride']['difficulty_estimate']},
	        {'column': 'Duration', 			  'value': values['summary']['ride']['duration']},
	        {'column': 'Class Thumbnail', 	  'value': values['summary']['ride']['image_url']},
	        {'column': 'Instructor ID', 	  'value': values['summary']['ride']['instructor_id']},
	        {'column': 'Total Ratings', 	  'value': values['summary']['ride']['overall_rating_count']},
	        {'column': 'Workout Name', 		  'value': values['summary']['ride']['title']},
	        {'column': 'Total Workouts', 	  'value': values['summary']['ride']['total_workouts']},
	        {'column': 'Start Time', 		  'value': values['summary']['start_time']},
	        {'column': 'Leaderboard Rank',    'value': values['summary']['leaderboard_rank']},
	        {'column': 'Leaderboard Users',   'value': values['summary']['total_leaderboard_users']},
	        {'column': 'Status', 			  'value': values['summary']['status']},
	        {'column': 'Workout Description', 'value': values['summary']['ride']['description']}
		))
	rows.append({'cells': cells})

new_rows_uri = 'https://coda.io/apis/v1/docs/' + coda_doc_id + '/tables/' + table_name+ '/rows'
payload = {'rows': rows}
new_rows = requests.post(new_rows_uri, headers=headers, json=payload)
print(new_rows.json())

# Current instructors
table_name_instructors = 'Instructors'
current_instructor_ids = []
current_instructors_uri = 'https://coda.io/apis/v1/docs/' + coda_doc_id + '/tables/' + table_name_instructors + '/rows'
current_instructors = requests.get(current_instructors_uri, headers=headers, params={})
for instructor_id in current_instructors.json()['items']:
	current_instructor_ids.append(instructor_id['name'])

# Get instructors from API
instructors = json.loads(json.dumps(s.get(base_url + '/api/instructor?limit=100').json()).replace('null', '""'))['data']

# Get new instructors
new_instructors = []
for instructor in instructors:
	if instructor['id'] not in current_instructor_ids:
		new_instructors.append(instructor)

# Push new instructors to Coda
rows = []
for instructor in new_instructors:
	cells = []
	cells.extend((
		{'column': 'Instructor ID',      'value': instructor['id']},
		{'column': 'Image URL',          'value': instructor['image_url']},
		{'column': 'Background',         'value': instructor['bio']},
		{'column': 'Name',               'value': instructor['name']},
		{'column': 'Instagram',          'value': instructor['instagram_profile']},
		{'column': 'Twitter',            'value': instructor['twitter_profile']},
		{'column': 'Quote',              'value': instructor['quote']},
		{'column': 'Spotify Playlist',   'value': instructor['spotify_playlist_uri']},
		{'column': 'Peloton Username',   'value': instructor['username']}
	))
	rows.append({'cells': cells})
new_instructor_rows_uri = 'https://coda.io/apis/v1/docs/' + coda_doc_id + '/tables/' + table_name_instructors + '/rows'
payload = {'rows': rows}
new_instructor_rows = requests.post(new_instructor_rows_uri, headers=headers, json=payload)
print(new_instructor_rows.json())
