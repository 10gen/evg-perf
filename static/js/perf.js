var numericFilter = function(x){
  return !isNaN(parseInt(x))
}

function average (arr){
  if(!arr || arr.length == 0) return // undefined for 0-length array
  return _.reduce(arr, function(memo, num){
    return memo + num;
  }, 0) / arr.length;
}


function PerfController($scope, $window, $http){
  $scope.Math = $window.Math;
  $scope.conf = $window.plugins["perf"];
  $scope.task = $window.task_data;
  $scope.currentSample;
  $scope.tablemode = "maxthroughput";
  $scope.perftab = 1;
  $scope.project = $window.project;
  $scope.getThreadKeys = function(r){
    var keys = _.uniq(_.filter(_.flatten(_.map(r, function(x){ return _.keys(x.results) }), true), numericFilter));
    return keys;
  }
  $scope.lockedSeries = {};
  $scope.compareHash = "";
  $scope.comparePerfSample = null;

  $scope.clearCompare = function(){
    $scope.compareHash = "";
    $scope.comparePerfSample = null;
    drawTrendGraph($scope.trendSamples, $scope, $scope.task.id, $scope.comparePerfSample);
  }

  // convert a percentage to a color. Higher -> greener, Lower -> redder.
  $scope.percentToColor = function(percent) {
    var percentColorRanges = [
    {min:-Infinity, max:-15, color: "#FF0000"},
    {min:-15, max:-10,       color: "#FF5500"},
    {min:-10, max:-5,        color: "#FFAA00"},
    {min:-5, max:-2.5,       color: "#FEFF00"},
    {min:-2.5, max:5,        color: "#A9FF00"},
    {min:5, max:10,          color: "#54FF00"},
    {min:10, max:+Infinity,  color: "#00FF00"}
    ];

    for(var i=0;i<percentColorRanges.length;i++){
      if(percent>percentColorRanges[i].min && percent<=percentColorRanges[i].max){
        return percentColorRanges[i].color;
      }
    }
    return "";
  }

  $scope.percentDiff = function(val1, val2){
    return (val1 - val2)/val1;
  }

  $scope.getPctDiff = function(referenceOps, sample, testKey){
    if(sample == null) return "";
    var compareTest = _.find(sample.data.results, function(x){return x.name == testKey});
    var compareMaxOps = $scope.getMax(compareTest.results);
    var pctDiff = (referenceOps-compareMaxOps)/referenceOps;
    return pctDiff;
  }

  $scope.getMax = function(r){
    return _.max(_.filter(_.pluck(_.values(r), 'ops_per_sec'), numericFilter));
  }

  function drawDetailGraph(sample, compareSample, taskId){
    var testNames = sample.testNames();
    for(var i=0;i<testNames.length;i++){
      var testName = testNames[i];
      $("#chart-" + taskId + "-" + i).empty();
      var series1 = sample.threadsVsOps(testName);
      var margin = { top: 20, right: 50, bottom: 30, left: 80 };
      var width = 450 - margin.left - margin.right;
      var height = 200 - margin.top - margin.bottom;
      var svg = d3.select("#chart-" + taskId + "-" + i)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var series = [series1];
      var numSeries = 1;
      if(!!compareSample){
        var series2 = compareSample.threadsVsOps(testName);
        series.push(series2);
      }

      var y = d3.scale.linear()
        .domain([0, d3.max(_.pluck(_.flatten(series), "ops_per_sec"))])
        .range([height, 0]);
      var x = d3.scale.ordinal()
        .domain(_.pluck(_.flatten(series), "threads"))
        .rangeRoundBands([0, width]);
      var x1 = d3.scale.ordinal()
        .domain(d3.range(series.length))
        .rangeBands([0, x.rangeBand()], .3);

      var z = d3.scale.category10();

      var bar = svg.selectAll("g")
        .data(series)
        .enter().append("g")
        .style("fill", function(d, i) { return z(i); })
        .attr("transform", function(d, i) { return "translate(" + x1(i) + ",0)"; });

      bar.selectAll("rect")
        .data(function(d){return d})
        .enter().append("rect")
        .attr('stroke', 'black')
        .attr('x', function(d, i) {
          return x(d.threads);
        })
        .attr('y', function(d){
          return y(d.ops_per_sec)
        })
        .attr('height', function(d) {
          return height-y(d.ops_per_sec)
        })
        .attr("width", x1.rangeBand());

      var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

      var errorBarArea = d3.svg.area()
        .x(function(d) {
          return x(d.threads) + (x1.rangeBand() / 2);
        })
        .y0(function(d) {
          return y(d3.min(d.ops_per_sec_values))     
        })
        .y1(function(d) {
          return y(d3.max(d.ops_per_sec_values))
        }).interpolate("linear");


      bar.selectAll(".err")
        .data(function(d) {
          return d.filter(function(d){
            return ("ops_per_sec_values" in d) && (d.ops_per_sec_values.length > 1);
          })
        })
      .enter().append("svg")
        .attr("class", "err")
        .append("path")
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("d", function(d) {
          return errorBarArea([d]);
        });

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");
      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
      svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);

      if(i==0 && series.length > 1){
        $('#legend').empty()
        var legendHeight = (series.length * 10);
        var legendWidth = 100;
        var legend_y = d3.scale.ordinal()
          .domain(d3.range(series.length))
          .rangeBands([0, legendHeight],.02);
        var svg = d3.select("#legend")
          .append("svg")
          .attr("width", legendWidth)
          .attr("height", (series.length * 50) + 10)
          .append("g");
        svg.selectAll("rect")
          .data(series)
          .enter()
          .append("rect")
          .attr("fill", function(d,i){return z(i)})
          .attr("x", function(d,i){return 0})
          .attr("y", function(d,i){return 5 + legend_y(i)})
          .attr("width", legendWidth/2)
          .attr("height", legend_y.rangeBand());
        svg.selectAll("text")
          .data(series)
          .enter()
          .append("text")
          .attr("x", function(d,i){return legendWidth/2+10})
          .attr("y", function(d,i){return 10 + legend_y(i)})
          .attr("dy", ".35em")
          .text(function(d,i){
            if(i==0){
              return "this task";
            }else{
              return compareSample.sample.revision.substring(0,5);
            }
          });
      }
    }
  }

  $scope.getSampleAtCommit = function(series, commit) {
    return _.find(series, function(x){return x.revision == commit});
  }

  $scope.getCommits = function(seriesByName){
    // get a unique list of all the revisions in the test series, accounting for gaps where some tests might have no data,
    // in order of push time.
    return _.uniq(_.pluck(_.sortBy(_.flatten(_.values(seriesByName)), "order"), "revision"), true);
  }

  $scope.updateComparison = function(x){
    $scope.compareHash = x;
    $http.get("/plugin/json/commit/" + $scope.project + "/" + $scope.compareHash + "/" + $scope.task.build_variant + "/" + $scope.task.display_name + "/perf").success(function(d){
      $scope.comparePerfSample = new TestSample(d);
      drawDetailGraph($scope.perfSample, $scope.comparePerfSample, $scope.task.id);
      drawTrendGraph($scope.trendSamples, $scope, $scope.task.id, $scope.comparePerfSample);
    }).error(function(){
      $scope.comparePerfSample = null;
    })
  }

  if($scope.conf.enabled){
    // Populate the graph and table for this task
    $http.get("/plugin/json/task/" + $scope.task.id + "/perf/")
      .success(function(d){
        $scope.perfSample = new TestSample(d);
        var w = 700;
        var bw = 1;
        var h = 100;
        setTimeout(function(){drawDetailGraph($scope.perfSample, null, $scope.task.id)},0);
      })

    // Populate the trend data
    $http.get("/plugin/json/history/" + $scope.task.id + "/perf")
      .success(function(d){
        $scope.trendSamples = new TrendSamples(d);
        setTimeout(function(){drawTrendGraph($scope.trendSamples, $scope, $scope.task.id, null)},0);
      })

    if($scope.task.patch_info && $scope.task.patch_info.Patch.Githash){
      //pre-populate comparison vs. base commit of patch.
      $scope.updateComparison($scope.task.patch_info.Patch.Githash);
    }
  }
}

function TrendSamples(samples){
  this.samples = samples;
  this._sampleByCommitIndexes = {};
  this.seriesByName = {};
  this.testNames = [];
  for (var i = 0; i < samples.length; i++) {
    for (var j = 0; j < samples[i].data.results.length; j++) {
      var name = samples[i].data.results[j].name;
      if (!(name in this.seriesByName)) {
        this.seriesByName[name] = [];
      }
      var rec = samples[i].data.results[j];
      var sorted = _.sortBy(_.filter(_.values(rec.results), function(x){return typeof(x)=="object"}), "ops_per_sec");
      this.seriesByName[name].push({
        revision: samples[i].revision,
        task_id: samples[i].task_id,
        "ops_per_sec": sorted[sorted.length-1].ops_per_sec,
        "ops_per_sec_values": sorted[sorted.length-1].ops_per_sec_values,
        order: samples[i].order,
      });
    }
  }

  for(key in this.seriesByName){
    this.seriesByName[key] = _.sortBy(this.seriesByName[key], 'order');
    this.testNames.unshift(key);
  }

  for(var i=0;i<this.testNames.length;i++){
    //make an index for commit hash -> sample for each test series
    var k = this.testNames[i];
    this._sampleByCommitIndexes[k] = _.groupBy(this.seriesByName[k], "revision"), function(x){return x[0]};
    for(t in this._sampleByCommitIndexes[k]){
      this._sampleByCommitIndexes[k][t] = this._sampleByCommitIndexes[k][t][0];
    }
  }

  this.tasksByCommitOrder = function(testName){
    if(!this._tasks){
      this._tasks = _.sortBy(_.uniq(_.flatten(_.values(this.seriesByName)), false,  function(x){return x.task_id}), "order");
    }
    return this._tasks;
  }

  this.sampleInSeriesAtCommit = function(testName, revision){
    return this._sampleByCommitIndexes[testName][revision];
  }

  this.noiseAtCommit = function(testName, revision){
    var sample = this._sampleByCommitIndexes[testName][revision];
    if(sample && sample.ops_per_sec_values && sample.ops_per_sec_values.length > 1){
      var r = (_.max(sample.ops_per_sec_values) - _.min(sample.ops_per_sec_values)) / average(sample.ops_per_sec_values);
      return r;
    }
  }

}

function TestSample(sample){
  this.sample = sample;
  this._threads = null;
  this._maxes = {};

  this.threads = function(){
    if(this._threads == null){
      this._threads = _.uniq(_.filter(_.flatten(_.map(this.sample.data.results, function(x){ return _.keys(x.results) }), true), numericFilter));
    }
    return this._threads;
  }

  this.testNames = function(){
    return _.pluck(this.sample.data.results, "name") ;
  }

  this.threadsVsOps = function(testName) {
    var testInfo = this.resultForTest(testName);
    var result = [];
    if (!testInfo)
      return;
    var series = testInfo.results;
    var keys = _.filter(_.keys(series), numericFilter);
    for (var j = 0; j < keys.length; j++) {
      result.push({
        threads: parseInt(keys[j]),
        ops_per_sec: series[keys[j]].ops_per_sec,
        ops_per_sec_values: series[keys[j]].ops_per_sec_values,
      });
    }
    _.sortBy(result, "threads");
    return result;
  }

  this.resultForTest = function(testName){
      return _.find(this.sample.data.results, function(x){return x.name == testName});
  }

  this.maxThroughputForTest = function(testName){
    if(!_.has(this._maxes, testName)){
      var d = this.resultForTest(testName);
      if(!d){
        return;
      }
      this._maxes[testName] = _.max(_.filter(_.pluck(_.values(d.results), 'ops_per_sec'), numericFilter));
    }
    return this._maxes[testName];
  }

}

var drawTrendGraph = function(trendSamples, scope, taskId, compareSample) {
  for (var i = 0; i < trendSamples.testNames.length; i++) {
    $("#perf-trendchart-" + taskId + "-" + i).empty();
    var margin = { top: 20, right: 50, bottom: 30, left: 50 }
    var width = 960 - margin.left - margin.right;
    var height = 200 - margin.top - margin.bottom;

    var key = trendSamples.testNames[i];
    var svg = d3.select("#perf-trendchart-" + taskId + "-" + i)
      .append("svg")
      .attr('class', "series")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);
    var series = trendSamples.seriesByName[key];
    var ops = _.pluck(series, 'ops_per_sec');
    var y = d3.scale.linear()
      .domain([d3.min(ops), d3.max(ops)])
      .range([height, 0]);
    var x = d3.scale.linear()
      .domain([0, ops.length - 1])
      .range([0, width]);

    var line = d3.svg.line()
      .x(function(d, i) {
        return x(i);
      })
      .y(function(d) {
        return y(d.ops_per_sec)
      });

    svg.append("path")
      .data([series])
      .attr("class", "line")
      .attr("d", line);

    var focus = svg.append("circle")
      .attr("r", 4.5);

    svg.selectAll(".point")
      .data(series)
      .enter()
      .append("svg:circle")
      .attr("class", "point")
      .attr("cx", function(d, i) {
        return x(i);
      })
      .attr("cy", function(d) {
        return y(d.ops_per_sec);
      })
      .attr("r", 2);
    svg.append("rect")
      .attr("class", "overlay")
      .attr("y", margin.top)
      .attr("width", width)
      .attr("height", height)
      .on("mouseover", function() {
        focus.style("display", null);
      })
      .on("mouseout", function() {
        focus.style("display", "none");
      })
      .on("mousemove", function(data, f, xscale, yscale, scope, series) {
        return function() {
          if(series in scope.lockedSeries){
            return;
          }
          var x0 = xscale.invert(d3.mouse(this)[0]);
          var i = Math.round(x0);
          f.attr("cx", x(i)).attr("cy", yscale(data[i].ops_per_sec));
          scope.currentSample = data[i];
          scope.currentHoverSeries = series;
          scope.$apply();
        }
      }(series, focus, x, y, scope, key))
      .on("click", function(key, scope){
          return function(){
            if(key in scope.lockedSeries){
              delete scope.lockedSeries[key];
              return;
            }
            scope.lockedSeries[key] = true;
          }
      }(key, scope))

    var avgOpsPerSec = d3.mean(ops)
    if (compareSample) {
      compareMax = compareSample.maxThroughputForTest(key)
      if (!isNaN(compareMax)) {
        var compareLine = d3.svg.line()
          .x(function(d, i) {
            return x(i);
          })
          .y(function(d) {
            return y(compareMax);
          })

        svg.append("line")
          .attr("stroke", "#6666FF")
          .attr("stroke-width", "1")
          .attr("stroke-dasharray", "5,5")
          .attr("class", "mean-line")
          .attr({
            x1: x(0),
            x2: x(width),
            y1: y(compareMax),
            y2: y(compareMax)
          })
      }
    }

    var padding = 30
    var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(5);
    svg.append("g")
      .attr("class", "axis")
      .call(yAxis);
  }
}
