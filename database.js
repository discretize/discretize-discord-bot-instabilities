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

exports.insertLog = function (json, permalink) {
    if (!json.success && json.triggerID !== 23254) {
        return;
    }
    const date = json.timeStartStd;
    const boss_id = json.triggerID;
    const timer = json.phases[0].end;

    const sql = `INSERT INTO group_kill (boss_id, date, timer, permalink)
                                VALUES ('${boss_id}', (SELECT CONVERT_TZ('${date.substr(0, 19)}', '${date.substr(20)}', '+00:00')), '${timer}', '${permalink}')
                                ON DUPLICATE KEY UPDATE boss_id='${boss_id}'`;
    connection.query(sql, function (err, res) {
        if (err) throw err;
    });

    json.players.forEach((player) => {
        const acc = player.account;
        const name = player.name;
        const spec = player.profession;

        const sql1 = `INSERT INTO player (acc) VALUES ('${acc}') ON DUPLICATE KEY UPDATE acc=acc`;
        connection.query(sql1, function (err, result) {
            if (err) throw err;
        });
        const sql2 = `INSERT INTO player_character (spec, name, player_id) 
                                VALUES ('${spec}', '${name}', (SELECT id FROM player p WHERE p.acc='${acc}')) 
                                ON DUPLICATE KEY UPDATE name=name`;
        connection.query(sql2, function (err, result) {
            if (err) throw err;
        });
        const dps_target = player.dpsTargets[0][0].dps;
        const dps_cleave = player.dpsAll[0].dps;

        const sql3 = `INSERT INTO player_kill (dps_target, dps_cleave, character_id, groupkill_id)
                                      VALUES  ('${dps_target}', '${dps_cleave}', 
                                                (SELECT id FROM player_character WHERE name='${name}' and spec='${spec}'),  
                                                (SELECT id FROM group_kill WHERE permalink='${permalink}')) 
                                     ON DUPLICATE KEY UPDATE dps_cleave=dps_cleave`;
        connection.query(sql3, function (err, result) {
            if (err) throw err;
        });
    });


}

exports.addCategory = function (permalink, cat) {
    const sql = `INSERT INTO kill_category (name, group_kill_id) VALUES ('${cat}', 
                      (  SELECT id FROM group_kill WHERE permalink = '${permalink}' ))
                       ON DUPLICATE KEY UPDATE name='${cat}'`
    connection.query(sql, function (err, result) {
        if (err) throw err;
    });
}

exports.partyPercentile = function (permalink, callback) {
    const sql = `   SELECT *
                    FROM (
                             SELECT boss_id,
                                    dps_target,
                                    dps_cleave,
                                    timer,
                                    permalink,
                                    ROUND(PERCENT_RANK() over (PARTITION BY boss_id ORDER BY dps_target), 2) t_percentile,
                                    ROUND(PERCENT_RANK() over (PARTITION BY boss_id ORDER BY dps_cleave), 2) c_percentile
                             FROM group_kill
                                      join (SELECT groupkill_id, sum(dps_cleave) as dps_cleave, sum(dps_target) as dps_target
                                            FROM player_kill
                                            group by groupkill_id) pk on group_kill.id = pk.groupkill_id
                         ) a
                    WHERE a.permalink = '${permalink}'`


    const sqlMembers = `SELECT *
                        FROM (
                                 SELECT boss_id,
                                        permalink,
                                        p.acc,
                                        pc.spec,
                                        pk.dps_target,
                                        pk.dps_cleave,
                                        Round(PERCENT_RANK() over (PARTITION BY boss_id, spec ORDER BY pk.dps_target), 2) t_percentile,
                                        Round(PERCENT_RANK() over (PARTITION BY boss_id, spec ORDER BY pk.dps_cleave), 2) c_percentile
                                 FROM group_kill
                                          join player_kill pk on group_kill.id = pk.groupkill_id
                                          join player_character pc on pk.character_id = pc.id
                                          join player p on p.id = pc.player_id
                             ) a
                        WHERE a.permalink = '${permalink}'`
    connection.query(sql, function (err, result) {
        if (err) throw err;
        connection.query(sqlMembers, function (err, result2) {
            if (err) throw err;
            if (result.length > 0) {
                callback(JSON.parse(JSON.stringify(result[0])), JSON.parse(JSON.stringify(result2)));
            }
        });
    });
}

exports.verify = function (acc, discord) {
    const sql = `INSERT INTO player (acc, discord, verified) VALUES ('${acc}', '${discord}', "1" ) ON DUPLICATE KEY UPDATE verified = '1'`
    connection.query(sql, function (err, result) {
        if (err) throw err;

    });
}