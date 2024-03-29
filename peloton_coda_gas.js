// One-way data sync from Peloton API to Coda in Google Apps Script
// Author: Al Chen (al@coda.io)
// Last Updated: December 11th, 2021
// Notes: Assumes you are using the V8 runtime (https://developers.google.com/apps-script/guides/v8-runtime)
// Coda's library for Google Apps Script: 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl
// Writeup and copyable template here: https://coda.io/@atc/analyze-your-peloton-workout-stats-with-real-time-updates

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
var codaFriendsWorkoutTable = 'Friend Workouts'

function runPelotonSync() {
  getPelotonWorkouts()
  getPelotonInstructors()
  getFriendWorkouts()
}

// Current workout IDs
function getWorkoutIds() {
  var currentWorkoutIds = []
  var currentRows = []
  var pageToken
  do {
    var response = CodaAPI.listRows(CODA_DOC_ID, CODA_TABLE_NAME, {limit: 500, pageToken: pageToken});
    var currentRows = currentRows.concat(response.items);
    pageToken = response.nextPageToken;
  } while (pageToken);
    currentRows.map(function(row) {
    currentWorkoutIds.push(row['name'])
  })
  return currentWorkoutIds
}
   
// Get workouts from Peloton API
function getPelotonWorkouts() {
  var workoutData = {}
  var page = 0
  do {
    var workouts = JSON.parse(UrlFetchApp.fetch(base_url + '/api/user/' + userID + '/workouts?limit=100&page=' + page, options), replacer) 
    workouts['data'].map(function(workout) {
      var workoutId = workout['id']
      workoutData[workoutId] = {}
      var workoutSummary = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId, options), replacer)
      var workoutPerformance = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId + '/performance_graph?every_n=1000',  options), replacer)
      workoutData[workoutId].summary = workoutSummary 
      workoutData[workoutId].performance = workoutPerformance
    })
    page++
  } while (workouts['data'].length > 0)

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
      {'column': 'Avg Output (kj)',       'value': (workoutData[workout]['performance']['average_summaries'].length < 1 || typeof workoutData[workout]['performance']['average_summaries'][0] === 'undefined' ? '' : workoutData[workout]['performance']['average_summaries'][0]['value'])},
      {'column': 'Avg Cadence',           'value': (workoutData[workout]['performance']['average_summaries'].length < 1 || typeof workoutData[workout]['performance']['average_summaries'][1] === 'undefined' ? '' : workoutData[workout]['performance']['average_summaries'][1]['value'])},
      {'column': 'Avg Resistance',        'value': (workoutData[workout]['performance']['average_summaries'].length < 1 || typeof workoutData[workout]['performance']['average_summaries'][2] === 'undefined' ? '' : workoutData[workout]['performance']['average_summaries'][2]['value'])},
      {'column': 'Avg Speed (mph)',       'value': (workoutData[workout]['performance']['average_summaries'].length < 1 || typeof workoutData[workout]['performance']['average_summaries'][3] === 'undefined' ? '' : workoutData[workout]['performance']['average_summaries'][3]['value'])},
      {'column': 'Total Output (kj)',     'value': (workoutData[workout]['performance']['summaries'].length < 1 || typeof workoutData[workout]['performance']['summaries'][0] === 'undefined' ? '' : workoutData[workout]['performance']['summaries'][0]['value'])},
      {'column': 'Distance (mi)',         'value': (workoutData[workout]['performance']['summaries'].length < 1 || typeof workoutData[workout]['performance']['summaries'][1] === 'undefined' ? '' : workoutData[workout]['performance']['summaries'][1]['value'])},
      {'column': 'Calories (kcal)',       'value': (workoutData[workout]['performance']['summaries'].length < 1 || typeof workoutData[workout]['performance']['summaries'][2] === 'undefined' ? '' : workoutData[workout]['performance']['summaries'][2]['value'])}
    ]
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

// Get friends you are following
function getFriendsData() {
  var friends = JSON.parse(UrlFetchApp.fetch(base_url + '/api/user/' + userID + '/following', options), replacer) 
  return friends['data']
}

// Get 10 latest workouts from friends
function getFriendWorkouts() {
  var friendsData = getFriendsData()
  // Add yourself to list to build leaderboard
  var me = JSON.parse(UrlFetchApp.fetch(base_url + '/api/user/' + userID, options), replacer) 
  friendsData.push({
    'id':         userID,
    'image_url':  me.image_url,
    'location':   me.location,
    'username':   me.username,
  }) 
  
  // Delete existing rows
  var currentRows = []
  var currentRowIds = []
  var pageToken  
  do {
    var response = CodaAPI.listRows(CODA_DOC_ID, codaFriendsWorkoutTable, {limit: 500, pageToken: pageToken});
    var currentRows = currentRows.concat(response.items);
    pageToken = response.nextPageToken;
  } while (pageToken);
  currentRows.map(function(row) {
    currentRowIds.push(row['id'])
  })
  CodaAPI.deleteRows(CODA_DOC_ID, codaFriendsWorkoutTable, {'rowIds' : currentRowIds})

  // Get all friends' cycling workouts limited to latest 10 workouts
  var friendWorkouts = {}  
  friendsData.map(function(friend) {
    var friendId = friend['id']
    friendWorkouts[friendId] = {}
    var currentFriendWorkouts = JSON.parse(UrlFetchApp.fetch(base_url + '/api/user/' + friendId + '/workouts', options), replacer)  
    currentFriendWorkouts['data'].map(function(currentFriendWorkout) {
      if (currentFriendWorkout['fitness_discipline'] == 'cycling' && Object.keys(friendWorkouts[friendId]).length < 10){
        var workoutId = currentFriendWorkout['id']
        var workoutSummary = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId, options), replacer)
        var workoutPerformance = JSON.parse(UrlFetchApp.fetch(base_url + '/api/workout/' + workoutId + '/performance_graph?every_n=1000', options), replacer)
        friendWorkouts[friendId][workoutId] = {}
        friendWorkouts[friendId][workoutId].image_url = friend['image_url']
        friendWorkouts[friendId][workoutId].username = friend['username']
        friendWorkouts[friendId][workoutId].location = friend['location']
        friendWorkouts[friendId][workoutId].summary = workoutSummary
        friendWorkouts[friendId][workoutId].performance = workoutPerformance
      }   
    })    
  })

  // Push to Friend Workouts to Coda table
  var rows = []
  for (friend in friendWorkouts) {
    for (workout in friendWorkouts[friend]) {
      var cells = []
      cells = [
        {'column': 'Peloton ID',            'value': friend}, 
        {'column': 'Username',              'value': friendWorkouts[friend][workout]['username']},
        {'column': 'Pic',                   'value': friendWorkouts[friend][workout]['image_url']},
        {'column': 'Location',              'value': friendWorkouts[friend][workout]['location']},
        {'column': 'Workout ID',            'value': workout},
        {'column': 'Workout Timestamp',     'value': friendWorkouts[friend][workout]['summary']['created_at']},
        {'column': 'Duration',              'value': friendWorkouts[friend][workout]['summary']['ride']['duration']},
        {'column': 'Output (kj)',           'value': (friendWorkouts[friend][workout]['performance']['summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['summaries'][0] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['summaries'][0]['value'])},
        {'column': 'Distance (mi)',         'value': (friendWorkouts[friend][workout]['performance']['summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['summaries'][1] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['summaries'][1]['value'])},
        {'column': 'Calories (kcal)',       'value': (friendWorkouts[friend][workout]['performance']['summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['summaries'][2] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['summaries'][2]['value'])},
        {'column': 'Avg Output (kj)',       'value': (friendWorkouts[friend][workout]['performance']['average_summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['average_summaries'][0] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['average_summaries'][0]['value'])},
        {'column': 'Avg Cadence (rpm)',     'value': (friendWorkouts[friend][workout]['performance']['average_summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['average_summaries'][1] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['average_summaries'][1]['value'])},
        {'column': 'Avg Resistance',        'value': (friendWorkouts[friend][workout]['performance']['average_summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['average_summaries'][2] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['average_summaries'][2]['value'])},
        {'column': 'Avg Speed (mph)',       'value': (friendWorkouts[friend][workout]['performance']['average_summaries'].length < 1 || typeof friendWorkouts[friend][workout]['performance']['average_summaries'][3] === 'undefined' ? '' : friendWorkouts[friend][workout]['performance']['average_summaries'][3]['value'])},
      ]
      rows.push({'cells': cells})
    }
  }
  CodaAPI.upsertRows(CODA_DOC_ID, codaFriendsWorkoutTable, {rows: rows});
  Logger.log('Added ' + rows.length + ' workouts from the ' + (friendsData.length - 1) + ' friends you follow.')  
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