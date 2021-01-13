// One-way data sync from Peloton API to Coda in Google Apps Script
// Author: Al Chen (al@coda.io)
// Last Updated: January 12th, 2021
// Notes: Assumes you are using the V8 runtime (https://developers.google.com/apps-script/guides/v8-runtime)
// Coda's library for Google Apps Script: 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl
// See full writeup here: 

//////////////// Setup and global variables ////////////////////////////////

CodaAPI.authenticate('YOUR_CODA_API_KEY')
CODA_DOC_ID = 'YOUR_CODA_DOC_ID'
PELOTON_USERNAME = 'YOUR_PELOTON_USERNAME'
PELOTON_PASSWORD = 'YOUR_PELOTON_PASSWORD'

////////////////////////////////////////////////////////////////////////////

var base_url = 'https://api.onepeloton.com'
var creds = auth()
var options = creds[0]
var userID = creds[1]
var CODA_TABLE_NAME = 'Workouts'

function runPelotonSync() {
  getPelotonWorkouts()
  getPelotonInstructors()  
}

// Current workout IDs
function getWorkoutIds() {
  var currentWorkoutIds = []
  var currentRows = CodaAPI.listRows(CODA_DOC_ID, CODA_TABLE_NAME).items
  currentRows.map(function(row) {
    currentWorkoutIds.push(row['name'])
  })
  return currentWorkoutIds
}
   
// Get workouts from Peloton API
function getPelotonWorkouts() {
  var workoutData = {}
  var workouts = JSON.parse(UrlFetchApp.fetch(base_url + '/api/user/' + userID + '/workouts?limit=1000', options), replacer) 
  workouts['data'].map(function(workout) {
	var workoutId = workout['id']
    workoutData[workoutId] = {}
	var workoutSummary = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId, options), replacer)
    var workoutPerformance = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId + '/performance_graph?every_n=1000', options), replacer)
	workoutData[workoutId].summary = workoutSummary	
	workoutData[workoutId].performance = workoutPerformance
  })

  // Remove workouts that already exist in Coda
  var currentWorkoutIds = getWorkoutIds()
  for (var i = 0; i < currentWorkoutIds.length; i++ ) {
    if (Object.keys(workoutData).indexOf(currentWorkoutIds[i]) !== -1) {
      delete workoutData[currentWorkoutIds[i]]
    }
  }
  
  // Push new workouts to Coda
  var rows = []
  for (workout in workoutData) {
    var cells = []
    if (workoutData[workout]['performance']['average_summaries'].length > 0) {  // for bike workouts
      cells = [
        {'column': 'Workout ID',            'value': workout}, 
        {'column': 'Date',                  'value': workoutData[workout]['summary']['created_at']},
        {'column': 'Workout Type',          'value': workoutData[workout]['summary']['fitness_discipline']},
        {'column': 'Difficulty',            'value': workoutData[workout]['summary']['ride']['difficulty_estimate']},
        {'column': 'Duration',              'value': workoutData[workout]['summary']['ride']['duration']},
        {'column': 'Class Thumbnail',       'value': workoutData[workout]['summary']['ride']['image_url']},
        {'column': 'Instructor ID',         'value': workoutData[workout]['summary']['ride']['instructor_id']},
        {'column': 'Total Ratings',         'value': workoutData[workout]['summary']['ride']['overall_rating_count']},
        {'column': 'Workout Name',          'value': workoutData[workout]['summary']['ride']['title']},
        {'column': 'Total Workouts',        'value': workoutData[workout]['summary']['ride']['total_workouts']},
        {'column': 'Start Time',            'value': workoutData[workout]['summary']['start_time']},
        {'column': 'Leaderboard Rank',      'value': workoutData[workout]['summary']['leaderboard_rank']},
        {'column': 'Leaderboard Users',     'value': workoutData[workout]['summary']['total_leaderboard_users']},
        {'column': 'Status',                'value': workoutData[workout]['summary']['status']},
        {'column': 'Workout Description',   'value': workoutData[workout]['summary']['ride']['description']},
        {'column': 'Avg Output (kj)',       'value': workoutData[workout]['performance']['average_summaries'][0]['value']},
        {'column': 'Avg Cadence',           'value': workoutData[workout]['performance']['average_summaries'][1]['value']},
        {'column': 'Avg Resistance',        'value': workoutData[workout]['performance']['average_summaries'][2]['value']},
        {'column': 'Avg Speed (mph)',       'value': workoutData[workout]['performance']['average_summaries'][3]['value']},
        {'column': 'Total Output (kj)',     'value': workoutData[workout]['performance']['summaries'][0]['value']},
        {'column': 'Distance (mi)',         'value': workoutData[workout]['performance']['summaries'][1]['value']},
        {'column': 'Calories (kcal)',       'value': workoutData[workout]['performance']['summaries'][2]['value']}
      ]
    } else {  // for non-bike workouts
      cells = [
        {'column': 'Workout ID',            'value': workout}, 
        {'column': 'Date',                  'value':  workoutData[workout]['summary']['created_at']},
        {'column': 'Workout Type',          'value': workoutData[workout]['summary']['fitness_discipline']},
        {'column': 'Difficulty',            'value': workoutData[workout]['summary']['ride']['difficulty_estimate']},
        {'column': 'Duration',              'value': workoutData[workout]['summary']['ride']['duration']},
        {'column': 'Class Thumbnail',       'value': workoutData[workout]['summary']['ride']['image_url']},
        {'column': 'Instructor ID',         'value': workoutData[workout]['summary']['ride']['instructor_id']},
        {'column': 'Total Ratings',         'value': workoutData[workout]['summary']['ride']['overall_rating_count']},
        {'column': 'Workout Name',          'value': workoutData[workout]['summary']['ride']['title']},
        {'column': 'Total Workouts',        'value': workoutData[workout]['summary']['ride']['total_workouts']},
        {'column': 'Start Time',            'value': workoutData[workout]['summary']['start_time']},
        {'column': 'Leaderboard Rank',      'value': workoutData[workout]['summary']['leaderboard_rank']},
        {'column': 'Leaderboard Users',     'value': workoutData[workout]['summary']['total_leaderboard_users']},
        {'column': 'Status',                'value': workoutData[workout]['summary']['status']},
        {'column': 'Workout Description',   'value': workoutData[workout]['summary']['ride']['description']},
      ]
    }
    rows.push({'cells': cells})
  }
  CodaAPI.upsertRows(CODA_DOC_ID, CODA_TABLE_NAME, {rows: rows});
  Logger.log('Added ' + rows.length + ' workouts')    
}
        
// Get instructors from Peloton API
function getPelotonInstructors() {
  var codaInstructorsTable = 'Instructors'
  var currentInstructorIds = []
  
  // Get current instructors in Coda
  var currentInstructors = CodaAPI.listRows(CODA_DOC_ID, codaInstructorsTable).items
  currentInstructors.map(function(instructor) {
    currentInstructorIds.push(instructor['name'])
  })   
  var instructors = JSON.parse(UrlFetchApp.fetch(base_url + '/api/instructor?limit=100', options), replacer)['data']
  
  // Remove instructors that already exist in Coda
  var newInstructors = []
  instructors.map(function(instructor) {
    if(currentInstructorIds.indexOf(instructor['id']) == -1) {
      newInstructors.push(instructor)
    }
  })
  
  // Push new instructors to Coda
  var rows = []
  newInstructors.map(function(instructor) {
    var cells = []
    cells = [
      {'column': 'Instructor ID',      'value': instructor['id']},
	    {'column': 'Image URL',          'value': instructor['image_url']},
	    {'column': 'Background',         'value': instructor['bio']},
	    {'column': 'Name',               'value': instructor['name']},
      {'column': 'Instagram',          'value': instructor['instagram_profile']},
	    {'column': 'Twitter',            'value': instructor['twitter_profile']},
	    {'column': 'Quote',              'value': instructor['quote']},
	    {'column': 'Spotify Playlist',   'value': instructor['spotify_playlist_uri']},
	    {'column': 'Peloton Username',   'value': instructor['username']}
    ]
    rows.push({'cells': cells}) 
  })
  CodaAPI.upsertRows(CODA_DOC_ID, codaInstructorsTable, {rows: rows});
  Logger.log('Added ' + rows.length + ' instructors') 
}
                   
// Helpers

function prettyPrint(value) {
  return JSON.stringify(value, null, 2);
} 

function auth() {
  var base_url = 'https://api.onepeloton.com'
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify({'username_or_email': PELOTON_USERNAME, 'password': PELOTON_PASSWORD}),
    'muteHttpExceptions' : true
  };
  var login = UrlFetchApp.fetch(base_url + '/auth/login', options);
  var cookie = login.getAllHeaders()['Set-Cookie'];
  for (var i = 0; i < cookie.length; i++) {   
    cookie[i] = cookie[i].split(';')[0];  
  };
  var authenticated_options = {'headers': {'Cookie': cookie.join(';')}}
  return [authenticated_options, JSON.parse(login.getContentText())['user_id']]
}
    
function replacer(key, value) { return (value == null) ? 0 : value }