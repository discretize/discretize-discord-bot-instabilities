var mysql = require('mysql');
var connection = mysql.createConnection({
    host: process.env.SQL_HOST,
    database: process.env.SQL_DB,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASS,
});

exports.connect = function () {
    connection.connect(function (err) {
        if (err) {
            console.error('Error connecting: ' + err.stack);
            return;
        }

        console.log('Connected as id ' + connection.threadId);
    });
}


exports.insertPlayer = function (acc, name, spec) {
    const sql = "INSERT INTO player SET acc = '" + acc + "', name = '" + name + "', spec = '" + spec + "' ON DUPLICATE KEY UPDATE acc=acc";
    const sql1 = "INSERT INTO player (acc, name, spec) VALUES( '" + acc + "', '" + name + "', '" + spec + "' )";
    connection.query(sql, function (err, result) {
        if (err) throw err;
    });
}

exports.insertGroupKill = function (boss_id, date, timer, dps_cleave, dps_target, permalink) {
    const sql = "INSERT IGNORE INTO group_kill SET boss_id = '" + boss_id + "', date = '" + date + "', timer = '" + timer + "', dps_cleave = '" + dps_cleave + "', dps_target = '" + dps_target + "', permalink = '" + permalink + "'";
    connection.query(sql, function (err, result) {
        if (err) throw err;
        return result.insertId;
    });
}

exports.insertPlayerKill = function (acc, name, spec, boss_id, date, timer, dps_target, dps_cleave) {
    const sql = `INSERT INTO player_kill 
                 SET groupkill_id = (SELECT id FROM group_kill WHERE boss_id = '${boss_id}' AND date = '${date}' AND timer = '${timer}'), 
                     player_id = (SELECT id FROM player WHERE acc = '${acc}' AND name = '${name}' AND spec = '${spec}'), 
                     dps_cleave = '${dps_cleave}', 
                     dps_target = '${dps_target}' 
                 ON DUPLICATE KEY UPDATE dps_cleave=dps_cleave`;
    connection.query(sql, function (err, result) {
        if (err) throw err;
    });
}

exports.partyPercentile = function (permalink, callback) {
    const sql = `SELECT boss_id, dps_target, dps_cleave, timer, t_percentile, c_percentile
                    FROM (
                             SELECT boss_id,
                                    permalink,
                                    dps_target,
                                    dps_cleave,
                                    timer,
                                    ROUND(PERCENT_RANK() over (PARTITION BY boss_id ORDER BY dps_target), 2) t_percentile,
                                    ROUND(PERCENT_RANK() over (PARTITION BY boss_id ORDER BY dps_cleave), 2) c_percentile
                             FROM group_kill
                         ) a
                    WHERE a.permalink = '${permalink}'`
    const sqlMembers = `SELECT acc, spec, t_percentile, c_percentile, dps_target, dps_cleave
                        FROM (
                                 SELECT boss_id,
                                        permalink,
                                        p.acc,
                                        p.spec,
                                        pk.dps_target,
                                        pk.dps_cleave,
                                        Round(PERCENT_RANK() over (PARTITION BY boss_id, spec ORDER BY pk.dps_target), 2) t_percentile,
                                        Round(PERCENT_RANK() over (PARTITION BY boss_id, spec ORDER BY pk.dps_cleave), 2) c_percentile
                                 FROM group_kill
                                          join player_kill pk on group_kill.id = pk.groupkill_id
                                          join player p on p.id = pk.player_id
                             ) a
                        WHERE a.permalink = '${permalink}'`
    connection.query(sql, function (err, result) {
        if (err) throw err;
        connection.query(sqlMembers, function (err, result2) {
            if (err) throw err;
            callback(JSON.parse(JSON.stringify(result[0])), JSON.parse(JSON.stringify(result2)));
        });
    });
}

exports.exec = function (query) {
    connection.query(query, function (err, result) {
        if (err) throw err;
        return result;
    });
}