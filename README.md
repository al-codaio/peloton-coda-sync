[![Coda API 1.0.0](https://img.shields.io/badge/Coda%20API-1.0.0-orange)](https://coda.io/developers/apis/v1)

# Sync data from Peloton to a table in a Coda doc
I have created a [Coda template](https://coda.io/@atc/analyze-your-peloton-workout-stats-with-real-time-updates) you can copy which contains the tables setup for syncing your own Peloton data. There are two scripts in this repo you can run to sync your [Peloton](https://www.onepeloton.com/) workout data to a [Coda](https://www.coda.io) doc. One script is meant to be run in [Google Apps Scripts](https://developers.google.com/apps-script/overview) and the other is a Python script you can run as a traditional cron job:
1. [**peloton_coda_gas.js**](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_gas.js) - For Google Apps Script ([gist](https://gist.github.com/albertc44/6419584906710daddbe5a4017ecc19bf))
2. [**peloton_coda_python.py**](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_python.py) - Python script to run locally or in the cloud as a cron job ([gist](https://gist.github.com/albertc44/b9cc9fe33a46cb014eef22f95cd4d459))

## Setup for Google Apps Script (recommended)
Starting in [line 10](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_gas.js#L10) to [line 13](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_gas.js#L13) of the [peloton_coda_gas.js](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_gas.js) script, you'll need to enter in some of your own data to make the script work. 

```javascript
CodaAPI.authenticate('YOUR_CODA_API_KEY')
CODA_DOC_ID = 'YOUR_CODA_DOC_ID'
PELOTON_USERNAME = 'YOUR_PELOTON_USERNAME'
PELOTON_PASSWORD = 'YOUR_PELOTON_PASSWORD'
```

Step-by-step:
1. Go to [script.google.com](script.google.com) and create a new project and give your project a name.
2. Click on **Libraries** and enter the following string into the "Script ID" field: `15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl`. *Note: If you are using the legacy Google Apps Scripted editor, go to **Libraries** then **Resources** in the toolbar.*
3. Click **Lookup** and then select version 9 of library to use (as of January 2021, version 9 - Coda API v1.0.0 is the latest). Don't touch the other settings. Click **Add**.
4. Copy and paste the [entire script](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_gas.js) into your Google Apps Script editor (by default, the script name is "Code.gs")
5. Go to your Coda [account settings](https://coda.io/account), scroll down until you see "API SETTINGS" and click **Generate API Token**. Copy and paste that API token into the value for `YOUR_CODA_API_KEY` in the script. *Note: do not delete the single apostrophes around* `YOUR_CODA_API_KEY`.
6. Make a copy of [this template](https://coda.io/@atc/analyze-your-peloton-workout-stats-with-real-time-updates) if you haven't already. 
7. In the Coda doc you created, go to the "All Workouts" page and delete all the dummy data by clicking the **Clear example data** button.
8. Get the the doc ID from your Coda doc by copying and pasting all the characters after the `_d` in the URL of your Coda doc (should be about 10 characters). You can also use the *Doc ID Extractor* tool in the [Coda API docs](https://coda.io/developers/apis/v1beta1#section/Using-the-API/Resource-IDs-and-Links). Copy and paste your doc ID into `YOUR_CODA_DOC_ID` in the script.
9. Fill in your Peloton username and password in `YOUR_PELOTON_USERNAME` and `YOUR_PELOTON_PASSWORD` (remember to keep the single quotes around both values). 
10. Click the dropdown menu next to the **Debug** button in the toolbar and select the `runPelotonSync` option.
![](https://p-ZmF7dQ.b0.n0.cdn.getcloudapp.com/items/DOuoZGyg/ea345472-486d-4b9f-a25e-796f52c311d8.jpg?v=b23049db474c1e63080e2975a9d1be90)
11. Click the **Run** ▶️ button and this sync all your Peloton workout data to the **Workouts** table in your Coda doc. Google may ask you to approve some permissions. You will get a message saying "Google hasn't verified this app." Click on **Advanced** and click on **Go to (script name)** to proceed).
12. Get the script to run daily by clicking on the clock 🕒 icon on the left sidebar and set up a [time-driven trigger](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers).
13. Click **create a new trigger**, make sure `runPelotonSync` is set as the function to run, "Select event source" should be `Time-driven`, and the type to "Hour timer." 

## Setup for Python script
*You have more flexibility with where and how you run the [Python script](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_python.py). The steps below is one method for setting up a serverless function to run on Google Cloud Platform.*

Step-by-step:
1. Set up a [Google Cloud Platform](https://console.cloud.google.com) project and [enable](https://cloud.google.com/service-usage/docs/enable-disable) the Cloud Functions API and Cloud Scheduler API.
2. Create a [Google Cloud Function](https://console.cloud.google.com/functions) and check "Allow unauthenticated invocations": ![](https://p-ZmF7dQ.b0.n0.cdn.getcloudapp.com/items/6quxleg4/eabedb30-1ab5-462a-a063-5300f9e6cc11.jpg?v=96618e6719528289bf6f06789911152f)
3. In the source code, select "Python 3.7" as the "Runtime" and edit the "Entry point" to a name like `runPelotonSync`. 
4. Copy and paste the whole [Python script](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_python.py) into `main.py.`
5. Above [line 19](https://github.com/albertc44/peloton-coda-sync/blob/master/peloton_coda_python.py#L19), "wrap" the whole script within a function like `pelotonData` (you may have to indent all the code below the function declaration): 
```python
def pelotonData(request):
  # Current workout IDs
  table_name = 'Workouts'
  headers = {'Authorization': 'Bearer ' + api_key}
  current_workout_ids = []
  ...
```
6. Click **Deploy** at the bottom of the screen and wait until you see the green checkmark in the Google Cloud Functions list.
7. Click into your new function and click **Trigger** to get the URL for triggering the script to run.
8. Set up a [Google Cloud Scheduler](https://console.cloud.google.com/cloudscheduler) job to run the script every day, week, etc. You would set the "Target" in the Cloud Scheduler job with the URL you got from your Google Cloud Function.

## Notes and caveats
* The Peloton API used in these scripts are *unofficial*, so there is no documentation from Peloton regarding the use of their API. They may change the API at any point in time.
* Don't be too aggressive with how often you run either script. Peloton may start rate-limiting you. 
* Don't share your Coda API key and Peloton login details 
* Props to [@geudrik](https://github.com/geudrik) and his [Peloton Client Library](https://github.com/geudrik/peloton-client-library). Use his library if you want to develop a custom application with your Peloton data.

## Video Tutorial
Coming soon
