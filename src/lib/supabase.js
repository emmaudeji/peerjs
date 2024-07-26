import supabase from "../utils/supabaseClient"

// Fetch all users data
export const getUsers = async () => {
  const { data, error } = await supabase
    .from('peers')
    .select('*')
  if (error) {
    console.log('FETCHING-ALL', error)
    throw error
  }

  // Use reduce to filter out duplicates based on peerId
  const uniqueData = data.reduce((acc, current) => {
    const x = acc.find(item => item.peerId === current.peerId);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  return uniqueData;
}

// Fetch all users data
export const getUserById = async (id) => {
    const { data, error } = await supabase
      .from('peers')
      .select('*')
      .eq('id',id)
      .single()
    if (error) {
      console.log('FETCHING-ALL', error)
    throw error
}
    return data
  }

// Insert user
export const addUser = async (user) => {
  const { data, error } = await supabase
    .from('peers')
    .insert([user])
    .select()
    .single()
  if (error) {
    console.log('ADDING-USER',error)
    throw error
  }
  return data
}


export const insertCharges = async (charges) => {
  const { data, error } = await supabase
    .from('charges')
    .insert([charges])
    .select()
    .single()
  if (error) {
    console.log('ADDING-CHARGES',error)
    throw error
  }
  return data
}

// Update a user
export const updateUser = async (id, updatedUser) => {
  const { data, error } = await supabase
    .from('peers')
    .update(updatedUser)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.log('UPDATING-USER',error)
    throw error
  }
  return data
}

// Delete a user
export const deleteUser = async (id) => {
  const { data, error } = await supabase
    .from('peers')
    .delete()
    .eq('id', id)
  if (error) {
    console.log('DELETING-USER',error)
    throw error
  }
  return data
}

// Subscribe to changes
// export const subscribeToChanges = () => {
//   return supabase
//     .from('peers')
//     .on('*', (payload) => {
//       console.log('Change received!', payload)
//     })
//     .subscribe()
// }

export const subscribeToChanges = async () => await supabase.channel('custom-all-channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'peers' },
    (payload) => {
        console.log('Change received!', payload)
        return payload
    }
  )
  .subscribe()