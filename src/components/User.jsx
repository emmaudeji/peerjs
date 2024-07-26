/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */

const User = ({item, idx, you}) => {
  return (
    <div className='w-80  border rounded-lg overflow-hidden '>
        <div className="bg-gray-200 h-24 w-full flex justify-center items-center text-xl font-semibold">
            &#8358;{ Math.round(item?.balance)}
        </div>
        <div className="p-6">
            <h5 className="">{item?.name}</h5>
            <p className="text-[12px] py-2"> {item?.peerId}</p>
            <button className="w-full bg-blue-600 text-white rounded-md text-center py-2 px-4">{you ? you : 'Pick User'}</button>
        </div>
        
    </div>
  )
}

export default User