from flask import Module

from flask import redirect,render_template,request,url_for
from random import sample

from util import *

study = Module(__name__)

from db import Database

#--------------------Create
@study.route("/study/create/")
def serve_create_study():
    if getLoggedInUser() is None:
        return redirect("/login/")
    return auto_template('study_create.html')
    
@study.route('/study/create/',methods=['POST'])
def create_study():    
    # Insert the new study into Mongo
    newStudyID = Database.studies.insert({
        'study_name': request.form['study_question'],
        'study_question': request.form['study_question'],
		'study_public': request.form['study_public'],
        'data_resolution': request.form['data_resolution'],
        'location_distribution': request.form['location_distribution'],
		'polygon': request.form['polygon']})
    # Return the ID for the client to rendezvous at /study/populate/<id>
    return jsonifyResponse({
        'studyID': str(newStudyID)
    })

#--------------------Populate
@study.route('/study/populate/<study_id>/',methods=['GET'])
def serve_populate_study(study_id):
    study = Database.getStudy(study_id)
    return render_template('study_populate.html',polygon=study['polygon'],study_id=study_id,
                           locDist = study['location_distribution'], dataRes = study['data_resolution'])

@study.route('/study/populate/<study_id>/',methods=['POST'])
def populate_study(study_id):
    Database.locations.insert({
        'loc': [request.form['lat'],request.form['lng']],
        'study_id': request.form['study_id'],
        'heading': 0,
        'pitch': 0,
        'bucket' : Buckets.Unknown,
        'votes' : 0
    })
    return jsonifyResponse({
        'success': True
    })

@study.route('/study/finish_populate/<study_id>/',methods=['POST'])
def finish_populate_study(study_id):
    if Database.getStudy(study_id) is None:
        return jsonifyResponse({
            'error': 'Study doesn\'t exist!'
        })
    locationsInQueue = Database.locations.find({
        'study_id': study_id,
        'bucket': Buckets.Queue
    })
    locationsToGet = Buckets.QueueSize-locationsInQueue.count()
    print locationsToGet," ARGGGGGGHHHH"
    # TODO: See if Mongo lets you do this in one update call.
    c=0
    #Temporary modification to allow for variable sizes of studies
    location = 'fill'
    while(location!=None):
        location = Database.locations.find_one({
            'study_id': study_id,
            'bucket': Buckets.Unknown
        })
	if(location==None):
		break
        location['bucket'] = Buckets.Queue
        Database.locations.save(location)
        c+=1
    print(c)
    return jsonifyResponse({
        'success': True
    })
    
#--------------------Curate
@study.route('/study/curate/<study_id>/',methods=['GET'])
def curate_study(study_id):
    study = Database.getStudy(study_id)
    locations = Database.getLocations(study_id)
    return auto_template('study_curate.html',polygon=study['polygon'],locations=locations)
    
@study.route('/study/curate/location/<id>',methods=['POST'])
def curate_location():    
    # Insert the new study into Mongo
    location = Database.getLocation(id)
    # Return the ID for the client to rendezvous at /study/populate/<id>
    return jsonifyResponse({
        'latitude': str(location.loc[0]),
        'longitude': str(location.loc[1]),
        'heading': str(location.heading),
        'pitch': str(location.pitch)
    })

@study.route('/study/curate/location/update/<id>',methods=['POST'])
def update_location(id):
    lat = request.form['lat']
    lng = request.form['lng']
    heading = request.form['heading']
    pitch = request.form['pitch']
    locationUpdated = Database.updateLocation(id,heading,pitch)
    return jsonifyResponse({
    'success': str(locationUpdated)
    })
    
@study.route('/study/curate/location/delete/<id>',methods=['POST'])
def delete_location(id):
    locationDeleted = Database.deleteLocation(id)
    return jsonifyResponse({
    'success': str(locationDeleted)
    })

#--------------------Vote
@study.route("/study/vote/<study_id>/",methods=['POST'])
def post_new_vote(study_id):
    def incVotes(obj):
        obj['votes'] += 1
        if obj['votes'] > 30:
            obj.bucket = Buckets.Archive

            newForQueue = Database.locations.find_one({ 'bucket': Buckets.Unknown })
            newForQueue['bucket'] = Buckets.Queue
            Database.locations.save(newForQueue)
        Database.locations.save(obj)


    leftObj = Database.getPlace(request.form['left'])
    rightObj = Database.getPlace(request.form['right'])
    if leftObj is None or rightObj is None:
        return jsonifyResponse({
            'error': "Locations don't exist!"
        })
    map(incVotes, [leftObj,rightObj])
    Database.votes.insert({
        'study_id' : request.form['study_id'],
        'left' : request.form['left'],
        'right' : request.form['right'],
        'choice' : request.form['choice']
    })
    return jsonifyResponse({
        'success': True
    })

@study.route("/study/getpair/<study_id>/",methods=['GET'])
def get_study_pairing(study_id):
    locationsInQueueCursor = Database.locations.find({ 'bucket': Buckets.Queue, 
                            'study_id': study_id }).limit(Buckets.QueueSize)
    locationsInQueue = [location for location in locationsInQueueCursor]
    locationsToDisplay = sample(locationsInQueue,2)
    return jsonifyResponse({
        'locs' : map(objifyPlace, locationsToDisplay)
    })

#--------------------View
@study.route("/study/view/<study_id>/",methods=['GET'])
def server_view_study(study_id):
    studyObj = Database.getStudy(study_id)
    if studyObj is None:
        return redirect('/')
    return auto_template('view_study.html',study_id=study_id,study_prompt=studyObj.get('study_question'))

@study.route('/location/view/<location_id>/',methods=['GET'])
def get_location(location_id):
	locationCursor = Database.getPlace(location_id)
	lat = locationCursor['loc'][0]
	lng = locationCursor['loc'][1]
	return "<img src='http://maps.googleapis.com/maps/api/streetview?size=404x296&location=" + lat + "," + lng + "&sensor=false'/>"

#--------------------Results
@study.route('/results/<study_id>/',methods = ['GET'])
def showData(study_id):
    L=""
    for x in Database.votes.find({'study_id':study_id}):
        leftStuff = re.sub("[^,0123456789.-]",'',str(Database.getPlace(x['left'])['loc']))
        rightStuff = re.sub("[^,0123456789.-]",'',str(Database.getPlace(x['right'])['loc']))
        L+=str(leftStuff)+","+str(rightStuff)+","+str(x['choice'])+","
    L=L[:-1]
    return auto_template('results.html',study_id=study_id, L=L)
