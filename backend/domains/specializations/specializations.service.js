import client from '../../connection.js'

// POST selected specializations for a lawyer
export async function addSpecializationsByRoleId(req, res) {
  const { role_id } = req.params;
  const { specializations } = req.body; // Array of specialization_ids (strings or numbers)

  if (!Array.isArray(specializations)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    // Ensure all incoming IDs are integers
    const selectedIds = specializations.map(id => parseInt(id)).filter(id => !isNaN(id));

    // Get existing specialization IDs
    const { rows: existing } = await client.query(
      'SELECT specialization_id FROM lawyer_specializations WHERE lawyer_id = $1',
      [role_id]
    );
    const existingIds = existing.map(row => parseInt(row.specialization_id));

    // Determine what to insert or delete
    const toInsert = selectedIds.filter(id => !existingIds.includes(id));
    const toDelete = existingIds.filter(id => !selectedIds.includes(id));

    // Perform deletions
    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM lawyer_specializations 
         WHERE lawyer_id = $1 AND specialization_id = ANY($2::int[])`,
        [role_id, toDelete]
      );
    }

    // Perform insertions
    for (const id of toInsert) {
      await client.query(
        'INSERT INTO lawyer_specializations (lawyer_id, specialization_id) VALUES ($1, $2)',
        [role_id, id]
      );
    }

    res.json({ message: 'Specializations updated' });
  } catch (err) {
    console.error('Error updating specializations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export async function addSpecializations(req, res) {
  const { specialization_name } = req.body;
  try {
    const check = await client.query(
      'SELECT * FROM specializations WHERE LOWER(specialization_name) = LOWER($1)',
      [specialization_name]
    );

    if (check.rows.length > 0) {
      return res.json({ success: false, message: "Specialization already exists!" });
    }

    await client.query(
      'INSERT INTO specializations (specialization_name) VALUES ($1)',
      [specialization_name]
    );

    res.json({ success: true, message: "Specialization added." });

  } catch (err) {
    console.error('Error in /api/add-specializations:', err);  // Log the error details
    res.status(500).json({ success: false, message: "Error adding specialization." });
  }
};

// Delete Specialization
export async function deleteSpecialization(req, res) {
  const { id } = req.params;
  try {
    await client.query('DELETE FROM specializations WHERE specialization_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Error deleting specialization." });
  }
};
///
export async function getSpecializations(req, res) {
  try {
    const result = await client.query('SELECT * FROM specializations ORDER BY specialization_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching specializations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
////
export async function getAllSpecializations(req, res) {
  try {
    const result = await client.query(
      'SELECT specialization_id, specialization_name AS name FROM specializations ORDER BY specialization_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching specializations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export async function getLawyerSpecializations(req, res) {
  const lawyerId = req.params.id;
  try {
    const result = await client.query(
      'SELECT specialization_id FROM lawyer_specializations WHERE lawyer_id = $1',
      [lawyerId]
    );
    const specializationIds = result.rows.map(row => row.specialization_id);
    res.json(specializationIds);
  } catch (err) {
    console.error('Error fetching lawyer specializations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}